<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Post;
use App\Models\User;
use App\Services\BoostAnalyticsService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class BoostController extends Controller
{
    /** Boost duration in hours */
    const BOOST_DURATION_HOURS = 6;
    const BOOST_UNIT_PRICE_EUR_CENTS = 1; // €0.010 per eligible user on the card rate

    /** Stand-in audience when a local database has nobody inside the radius. */
    private const LOCAL_MIN_AUDIENCE = 150;

    /**
     * Duration multipliers used in the frontend.
     * Keep in sync with src/components/BoostSelectionModal.tsx
     */
    private function durationMultiplier(int $durationHours): float
    {
        return \App\Services\BoostPricing::durationMultiplier($durationHours);
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadiusKm * $c;
    }

    private function getCentroidCoords(?string $label): ?array
    {
        if (!$label) return null;
        static $cache = [];
        if (isset($cache[$label])) return $cache[$label];

        $row = DB::table('location_centroids')->where('label', $label)->first(['latitude', 'longitude']);
        if ($row) {
            $coords = ['lat' => (float) $row->latitude, 'lng' => (float) $row->longitude];
            $cache[$label] = $coords;
            return $coords;
        }

        // Live Google resolve + cache when the seed table does not have this place yet.
        try {
            $resolved = (new \App\Services\GoogleMapsLocationService)->resolve(null, $label);
            if ($resolved && isset($resolved['latitude'], $resolved['longitude'])) {
                $coords = ['lat' => (float) $resolved['latitude'], 'lng' => (float) $resolved['longitude']];
                $cache[$label] = $coords;
                return $coords;
            }
        } catch (\Throwable $_) {
            // ignore — pricing falls back to 0 eligible users
        }

        $cache[$label] = null;
        return null;
    }

    /**
     * Count eligible users for pricing (audience-size pricing).
     * - Excludes the boosting user
     * - Measures distance from the booster user's local centroid
     * - Candidate pool is based on feed_type (local/regional/national)
     */
    private function estimateEligibleUsersCount(string $userId, string $feedType, float $radiusKm): int
    {
        $booster = User::find($userId);
        if (!$booster) return 0;

        $centerCoords =
            $this->getCentroidCoords($booster->location_local) ??
            $this->getCentroidCoords($booster->location_regional) ??
            $this->getCentroidCoords($booster->location_national);

        if (!$centerCoords) return 0;

        $candidateQuery = User::query()->where('id', '!=', $userId);

        if ($feedType === 'local') {
            if (!$booster->location_local) return 0;
            $candidateQuery->where('location_local', $booster->location_local);
        } elseif ($feedType === 'regional') {
            if (!$booster->location_regional) return 0;
            $candidateQuery->where('location_regional', $booster->location_regional);
        } elseif ($feedType === 'national') {
            if (!$booster->location_national) return 0;
            $candidateQuery->where('location_national', $booster->location_national);
        }

        $candidates = $candidateQuery->select(['id', 'location_local', 'location_regional', 'location_national'])->get();

        $count = 0;
        foreach ($candidates as $candidate) {
            $coords =
                $this->getCentroidCoords($candidate->location_local) ??
                $this->getCentroidCoords($candidate->location_regional) ??
                $this->getCentroidCoords($candidate->location_national);

            if (!$coords) continue;

            $distanceKm = $this->haversineKm(
                $centerCoords['lat'],
                $centerCoords['lng'],
                $coords['lat'],
                $coords['lng']
            );

            if ($distanceKm <= $radiusKm) $count++;
        }

        return $count;
    }

    /**
     * Local development has no nearby users, so the boost screen would show an empty audience.
     * Production always keeps the real spatial count, including zero.
     */
    /**
     * The ad budget for one gateway: card is €0.010 per person, store is €0.0125, times duration.
     */
    public function audiencePriceCents(string $userId, string $feedType, float $radiusKm, int $durationHours, string $gateway = 'stripe'): int
    {
        $eligibleUsers = $this->audienceCountForEnvironment(
            $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm)
        );

        return \App\Services\BoostPricing::audienceCents($eligibleUsers, $durationHours, $gateway);
    }

    private function audienceCountForEnvironment(int $eligibleUsers): int
    {
        if ($eligibleUsers > 0 || ! app()->environment('local')) {
            return $eligibleUsers;
        }

        return self::LOCAL_MIN_AUDIENCE;
    }

    /**
     * Create a Stripe PaymentIntent for a boost. Returns client_secret for frontend confirmCardPayment.
     */
    public function createPaymentIntent(Request $request)
    {
        $request->validate([
            'feedType' => 'required|string|in:local,regional,national',
            'postId'   => 'required|string|max:255',
            'userId'   => 'required|string|max:255',
            'radiusKm' => 'required|numeric|min:0.1',
            'durationHours' => 'required|integer|in:6,12,24,72',
        ]);

        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        $feedType = (string) $request->input('feedType');
        $currency = config('boost.currency', 'eur');

        $userId = (string) $request->input('userId');
        $radiusKm = (float) $request->input('radiusKm');
        $durationHours = (int) $request->input('durationHours');

        $eligibleUsers = $this->audienceCountForEnvironment(
            $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm)
        );
        $priceCents = \App\Services\BoostPricing::audienceCents($eligibleUsers, $durationHours);

        if ($priceCents <= 0) {
            return response()->json([
                'error' => 'NO_ELIGIBLE_AUDIENCE',
                'eligibleUsersCount' => $eligibleUsers,
                'priceCents' => $priceCents,
            ], 400);
        }

        try {
            \Stripe\Stripe::setApiKey($secret);

            $intent = \Stripe\PaymentIntent::create([
                'amount'   => $priceCents,
                'currency' => $currency,
                'automatic_payment_methods' => ['enabled' => true],
                'metadata' => [
                    'post_id'   => $request->input('postId'),
                    'feed_type' => $feedType,
                    'user_id' => $userId,
                    'radius_km' => $radiusKm,
                    'duration_hours' => $durationHours,
                    'eligible_users_count' => $eligibleUsers,
                ],
            ]);

            return response()->json([
                'clientSecret' => $intent->client_secret,
                'eligibleUsersCount' => $eligibleUsers,
                'priceCents' => $priceCents,
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe PaymentIntent create failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Estimate both gateway prices from the audience and the duration multiplier.
     * Card is €0.010 per person. Store is €0.0125 per person.
     */
    public function estimate(Request $request): JsonResponse
    {
        $request->validate([
            'feedType' => 'required|string|in:local,regional,national',
            'userId' => 'required|string|max:255',
            'radiusKm' => 'required|numeric|min:0.1',
            'durationHours' => 'required|integer|in:6,12,24,72',
        ]);

        $feedType = (string) $request->input('feedType');
        $userId = (string) $request->input('userId');
        $radiusKm = (float) $request->input('radiusKm');
        $durationHours = (int) $request->input('durationHours');
        $multiplier = $this->durationMultiplier($durationHours);

        $eligibleUsers = $this->audienceCountForEnvironment(
            $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm)
        );
        $stripeCents = \App\Services\BoostPricing::audienceCents($eligibleUsers, $durationHours, 'stripe');
        $storeCents = \App\Services\BoostPricing::audienceCents($eligibleUsers, $durationHours, 'store');

        return response()->json([
            'currency' => config('boost.currency', 'eur'),
            'unitPriceCents' => self::BOOST_UNIT_PRICE_EUR_CENTS,
            'durationHours' => $durationHours,
            'durationMultiplier' => $multiplier,
            'feedType' => $feedType,
            'radiusKm' => $radiusKm,
            'eligibleUsersCount' => $eligibleUsers,
            'priceCents' => $stripeCents,
            'priceEur' => $stripeCents / 100,
            'gateways' => [
                'stripe' => [
                    'unitPriceEur' => \App\Services\BoostPricing::STRIPE_UNIT_PRICE_EUR,
                    'priceCents' => $stripeCents,
                    'priceEur' => $stripeCents / 100,
                ],
                'store' => [
                    'unitPriceEur' => \App\Services\BoostPricing::STORE_UNIT_PRICE_EUR,
                    'priceCents' => $storeCents,
                    'priceEur' => $storeCents / 100,
                ],
            ],
        ]);
    }

    /**
     * Activate a boost after successful Stripe payment. Verifies PaymentIntent with Stripe before persisting.
     */
    public function activate(Request $request)
    {
        $request->validate([
            'paymentIntentId' => 'required|string|max:255',
            'postId'         => 'required|string|uuid',
            'feedType'       => 'required|string|in:local,regional,national',
            'userId'         => 'required|string|uuid',
            'price'          => 'required|numeric|min:0',
            'radiusKm' => 'nullable|numeric|min:0',
            'eligibleUsersCount' => 'nullable|integer|min:0',
            'durationHours' => 'nullable|integer|in:6,12,24,72',
            'centerLocal' => 'nullable|string|max:200',
        ]);

        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        try {
            \Stripe\Stripe::setApiKey($secret);
            $intent = \Stripe\PaymentIntent::retrieve($request->input('paymentIntentId'));

            if ($intent->status !== 'succeeded') {
                return response()->json(['error' => 'Payment not completed'], 400);
            }

            $postId = $request->input('postId');
            $feedType = $request->input('feedType');
            $userId = $request->input('userId');

            $radiusKm = $request->input('radiusKm');
            $durationHours = $request->input('durationHours');

            $metaPostId = $intent->metadata->post_id ?? null;
            $metaFeedType = $intent->metadata->feed_type ?? null;
            $metaUserId = $intent->metadata->user_id ?? null;
            $metaRadius = $intent->metadata->radius_km ?? null;
            $metaDurationHours = $intent->metadata->duration_hours ?? null;

            if ($metaPostId !== $postId || $metaFeedType !== $feedType) {
                return response()->json(['error' => 'Payment metadata mismatch'], 400);
            }

            // Additional checks when metadata is present (safe for the new radius pricing flow).
            if ($metaUserId !== null && (string)$metaUserId !== (string)$userId) {
                return response()->json(['error' => 'Payment metadata mismatch'], 400);
            }
            if ($metaRadius !== null && $radiusKm !== null && (float)$metaRadius !== (float)$radiusKm) {
                return response()->json(['error' => 'Payment metadata mismatch'], 400);
            }
            if ($metaDurationHours !== null && $durationHours !== null && (int)$metaDurationHours !== (int)$durationHours) {
                return response()->json(['error' => 'Payment metadata mismatch'], 400);
            }

            $now = now();
            $durationHours = (int) ($request->input('durationHours') ?? self::BOOST_DURATION_HOURS);
            $expiresAt = $now->copy()->addHours($durationHours);

            $boost = Boost::create([
                'post_id'          => $request->input('postId'),
                'user_id'          => $request->input('userId'),
                'feed_type'        => $request->input('feedType'),
                'price'            => $request->input('price'),
                'radius_km'        => $request->input('radiusKm'),
                'center_local'     => $request->input('centerLocal'),
                'eligible_users_count' => $request->input('eligibleUsersCount'),
                'duration_hours'   => $durationHours,
                'payment_intent_id' => $intent->id,
                'activated_at'     => $now,
                'expires_at'       => $expiresAt,
            ]);

            return response()->json([
                'boost' => [
                    'id'           => $boost->id,
                    'postId'       => $boost->post_id,
                    'feedType'     => $boost->feed_type,
                    'activatedAt'  => $boost->activated_at->toIso8601String(),
                    'expiresAt'    => $boost->expires_at->toIso8601String(),
                ],
            ]);
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            Log::warning('Stripe PaymentIntent retrieve failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Invalid payment'], 400);
        } catch (\Throwable $e) {
            Log::error('Boost activate failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Record a feed impression, unique reach, or detail click for an active boost.
     */
    public function track(Request $request, int $boostId): JsonResponse
    {
        $validated = $request->validate([
            'event' => 'required|string|in:impression,reach,click',
        ]);

        try {
            $boost = Boost::query()->active()->find($boostId);
            if ($boost) {
                BoostAnalyticsService::trackClientEvent(
                    $boost,
                    (string) $validated['event'],
                    $request->user() ? (string) $request->user()->id : null
                );
            }
        } catch (\Throwable $e) {
            Log::warning('Boost track failed', ['boost_id' => $boostId, 'error' => $e->getMessage()]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Get active boosted post IDs for a feed type.
     * Returns empty array on DB/driver errors so the feed still loads.
     */
    public function activeIds(Request $request)
    {
        $feedType = $request->query('feedType', 'local');
        if (!in_array($feedType, ['local', 'regional', 'national'], true)) {
            return response()->json(['error' => 'Invalid feed type'], 400);
        }

        try {
            $rows = Boost::active()
                ->forFeedType($feedType)
                ->orderByDesc('activated_at')
                ->get(['id', 'post_id']);
            $boostIdsByPost = [];
            foreach ($rows as $row) {
                $postId = (string) $row->post_id;
                if (! isset($boostIdsByPost[$postId])) {
                    $boostIdsByPost[$postId] = (int) $row->id;
                }
            }

            return response()->json([
                'postIds' => array_keys($boostIdsByPost),
                'boostIdsByPost' => $boostIdsByPost,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Boost activeIds failed (e.g. DB driver missing)', ['error' => $e->getMessage()]);
            return response()->json(['postIds' => [], 'boostIdsByPost' => []]);
        }
    }

    /**
     * Get boost status for a single post.
     * Returns inactive on DB/driver errors so the UI doesn't break.
     */
    public function status(Request $request, string $postId)
    {
        try {
            $boost = Boost::where('post_id', $postId)->active()->first();

            if (!$boost) {
                return response()->json([
                    'isActive'     => false,
                    'timeRemaining' => 0,
                    'feedType'     => null,
                    'activatedAt'  => null,
                    'expiresAt'    => null,
                ]);
            }

            $remaining = max(0, (int) $boost->expires_at->diffInMilliseconds(now(), false));

            return response()->json([
                'isActive'      => true,
                'timeRemaining' => $remaining,
                'feedType'      => $boost->feed_type,
                'activatedAt'   => $boost->activated_at->toIso8601String(),
                'expiresAt'     => $boost->expires_at->toIso8601String(),
                'spendEur'      => $this->spendEurForBoost($boost),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Boost status failed', ['postId' => $postId, 'error' => $e->getMessage()]);
            return response()->json([
                'isActive'     => false,
                'timeRemaining' => 0,
                'feedType'     => null,
                'activatedAt'  => null,
                'expiresAt'    => null,
            ]);
        }
    }

    /**
     * Get boost analytics for a post (owner only).
     * Returns active boost analytics when available, else most recent historical boost.
     */
    public function analytics(Request $request, string $postId): JsonResponse
    {
        $viewer = Auth::user();
        if (!$viewer) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $range = (string) $request->query('range', 'all');
        if (!in_array($range, ['24h', '7d', 'all'], true)) {
            $range = 'all';
        }

        $boost = Boost::where('post_id', $postId)
            ->where('user_id', $viewer->id)
            ->orderByRaw('CASE WHEN expires_at > ? THEN 0 ELSE 1 END', [now()])
            ->orderByDesc('activated_at')
            ->first();

        $fromTs = null;
        if ($range === '24h') {
            $fromTs = now()->subDay();
        } elseif ($range === '7d') {
            $fromTs = now()->subDays(7);
        }

        if (!$boost) {
            $post = Post::where('id', $postId)->where('user_id', $viewer->id)->first();
            $profileVisits = BoostAnalyticsService::profileVisitCountForUser((string) $viewer->id, $fromTs);
            return response()->json([
                'hasBoost' => false,
                'isActive' => false,
                'postId' => $postId,
                'range' => $range,
                'spend' => $this->spendEurForPost($postId, (string) $viewer->id),
                'spendEur' => $this->spendEurForPost($postId, (string) $viewer->id),
                'analytics' => $post ? [
                    'impressions' => (int) ($post->views_count ?? 0),
                    'likes' => (int) ($post->likes_count ?? 0),
                    'comments' => (int) ($post->comments_count ?? 0),
                    'shares' => (int) ($post->shares_count ?? 0),
                    'profileVisits' => $profileVisits,
                    'messageStarts' => 0,
                    'costPerProfileVisit' => null,
                    'costPerMessageStart' => null,
                    'trend' => ['impressions' => []],
                    'sourceMatchedEventsCount' => 0,
                ] : null,
            ]);
        }

        $eventsQuery = BoostAnalyticsEvent::query()->where('boost_id', $boost->id);
        if ($fromTs) {
            $eventsQuery->where('created_at', '>=', $fromTs);
        }
        $events = $eventsQuery->get(['event_type', 'created_at']);
        $counts = [
            'impression' => 0,
            'like' => 0,
            'comment' => 0,
            'share' => 0,
            'profile_visit' => 0,
            'message_start' => 0,
        ];
        foreach ($events as $event) {
            $type = (string) $event->event_type;
            if (array_key_exists($type, $counts)) {
                $counts[$type]++;
            }
        }

        // If no event rows (e.g. legacy boosts), fall back to cumulative counters.
        $impressions = $events->isEmpty() && $range === 'all' ? (int) ($boost->impressions_count ?? 0) : (int) $counts['impression'];
        $likes = $events->isEmpty() && $range === 'all' ? (int) ($boost->likes_count ?? 0) : (int) $counts['like'];
        $comments = $events->isEmpty() && $range === 'all' ? (int) ($boost->comments_count ?? 0) : (int) $counts['comment'];
        $shares = $events->isEmpty() && $range === 'all' ? (int) ($boost->shares_count ?? 0) : (int) $counts['share'];
        $post = Post::query()->find($boost->post_id);
        if ($post) {
            $impressions = max($impressions, (int) ($post->views_count ?? 0));
            $likes = max($likes, (int) ($post->likes_count ?? 0));
            $comments = max($comments, (int) ($post->comments_count ?? 0));
            $shares = max($shares, (int) ($post->shares_count ?? 0));
        }
        $profileVisits = max(
            (int) $counts['profile_visit'],
            BoostAnalyticsService::profileVisitCountForUser((string) $viewer->id, $fromTs)
        );
        $messagesStarted = (int) $counts['message_start'];

        // Build simple trend buckets for sparkline-like UI.
        $bucketFormat = $range === '24h' ? 'Y-m-d H:00' : 'Y-m-d';
        $trendMap = [
            'impressions' => [],
            'likes' => [],
            'comments' => [],
            'shares' => [],
        ];
        foreach ($events as $event) {
            $bucket = $event->created_at->format($bucketFormat);
            $key = match ((string) $event->event_type) {
                'impression' => 'impressions',
                'like' => 'likes',
                'comment' => 'comments',
                'share' => 'shares',
                default => null,
            };
            if (!$key) continue;
            if (!isset($trendMap[$key][$bucket])) {
                $trendMap[$key][$bucket] = 0;
            }
            $trendMap[$key][$bucket]++;
        }

        $trend = [];
        foreach ($trendMap as $metric => $bucketCounts) {
            ksort($bucketCounts);
            $trend[$metric] = [];
            foreach ($bucketCounts as $bucket => $value) {
                $trend[$metric][] = ['bucket' => $bucket, 'value' => $value];
            }
        }

        $sourceMatchedEventsCount = BoostAnalyticsEvent::query()
            ->where('boost_id', $boost->id)
            ->where('attribution_context', 'source_post')
            ->when($fromTs, fn ($q) => $q->where('created_at', '>=', $fromTs))
            ->count();

        $price = $this->spendEurForBoost($boost);
        $costPerProfileVisit = $profileVisits > 0 ? round($price / $profileVisits, 4) : null;
        $costPerMessageStart = $messagesStarted > 0 ? round($price / $messagesStarted, 4) : null;

        return response()->json([
            'hasBoost' => true,
            'isActive' => $boost->expires_at && $boost->expires_at->isFuture(),
            'boostId' => $boost->id,
            'postId' => $boost->post_id,
            'range' => $range,
            'feedType' => $boost->feed_type,
            'activatedAt' => optional($boost->activated_at)->toIso8601String(),
            'expiresAt' => optional($boost->expires_at)->toIso8601String(),
            'spend' => $price,
            'spendEur' => $price,
            'analytics' => [
                'impressions' => $impressions,
                'likes' => $likes,
                'comments' => $comments,
                'shares' => $shares,
                'profileVisits' => (int) $profileVisits,
                'messageStarts' => (int) $messagesStarted,
                'costPerProfileVisit' => $costPerProfileVisit,
                'costPerMessageStart' => $costPerMessageStart,
                'lastUpdatedAt' => optional($boost->last_analytics_event_at)->toIso8601String(),
                'trend' => $trend,
                'sourceMatchedEventsCount' => (int) $sourceMatchedEventsCount,
            ],
        ]);
    }

    /**
     * The signed-in user's posts, filtered by boost status, plus counts for every tab.
     *
     * Active means a boost whose expires_at is still in the future. Ended means a boost
     * that already expired and no newer boost is live. Ready means the post has never
     * had a live boost.
     */
    public function posts(Request $request): JsonResponse
    {
        $viewer = Auth::user();
        if (! $viewer) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $status = (string) $request->query('status', 'all');
        if (! in_array($status, ['all', 'ready', 'active', 'ended'], true)) {
            $status = 'all';
        }

        $owned = Post::query()
            ->where('user_id', $viewer->id)
            ->notReclipped();

        $activeIds = Boost::query()
            ->where('user_id', $viewer->id)
            ->where('expires_at', '>', now())
            ->pluck('post_id');

        $endedIds = Boost::query()
            ->where('user_id', $viewer->id)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->when($activeIds->isNotEmpty(), fn ($query) => $query->whereNotIn('post_id', $activeIds))
            ->pluck('post_id');

        $allCount = (clone $owned)->count();
        $activeCount = $activeIds->isEmpty()
            ? 0
            : (clone $owned)->whereIn('id', $activeIds)->count();
        $endedCount = $endedIds->isEmpty()
            ? 0
            : (clone $owned)->whereIn('id', $endedIds)->count();
        $readyCount = max(0, $allCount - $activeCount - $endedCount);

        $postsQuery = (clone $owned)->with('user')->orderByDesc('created_at')->limit(50);
        if ($status === 'active') {
            $postsQuery->whereIn('id', $activeIds->isEmpty() ? ['__none__'] : $activeIds);
        } elseif ($status === 'ended') {
            $postsQuery->whereIn('id', $endedIds->isEmpty() ? ['__none__'] : $endedIds);
        } elseif ($status === 'ready') {
            $busyIds = $activeIds->merge($endedIds)->unique()->values();
            if ($busyIds->isNotEmpty()) {
                $postsQuery->whereNotIn('id', $busyIds);
            }
        }

        $posts = $postsQuery->get();
        $boostsByPost = Boost::query()
            ->where('user_id', $viewer->id)
            ->whereIn('post_id', $posts->pluck('id'))
            ->orderByDesc('expires_at')
            ->get()
            ->groupBy('post_id');

        $payload = $posts->map(function (Post $post) use ($boostsByPost, $activeIds, $endedIds) {
            $boostStatus = $activeIds->contains($post->id)
                ? 'active'
                : ($endedIds->contains($post->id) ? 'ended' : 'ready');
            $rows = $boostsByPost->get($post->id, collect());
            $representative = $rows->first(fn (Boost $boost) => $boost->expires_at && $boost->expires_at->isFuture())
                ?: $rows->first();
            $data = $post->toArray();
            $poster = $post->resolvedThumbnailUrl();
            $data['user_handle'] = $data['user_handle'] ?: $post->user?->handle;
            $data['thumbnail_url'] = $poster;
            $data['video_poster_url'] = $poster;
            $data['poster_url'] = $poster;
            $data['boost_status'] = $boostStatus;
            $data['is_boosted'] = $boostStatus === 'active';
            $data['boost_feed_type'] = $representative?->feed_type;
            $data['spend_eur'] = $representative ? $this->spendEurForBoost($representative) : 0;

            return $data;
        })->values();

        return response()->json([
            'success' => true,
            'status' => $status,
            'counts' => [
                'all' => $allCount,
                'ready' => $readyCount,
                'active' => $activeCount,
                'ended' => $endedCount,
            ],
            'posts' => $payload,
        ]);
    }

    private function spendEurForBoost(Boost $boost): float
    {
        return $boost->chargedSpendEur();
    }

    private function spendEurForPost(string $postId, string $userId): float
    {
        $boost = Boost::query()
            ->where('post_id', $postId)
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();

        return $boost ? $this->spendEurForBoost($boost) : 0.0;
    }
}
