<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class BoostController extends Controller
{
    /** Price in cents per eligible user reached. Single source of truth: config/boost.php */
    private function unitPriceCents(): int
    {
        return (int) config('boost.unit_price_cents', 5);
    }

    /**
     * Duration multipliers used in the frontend.
     * Keep in sync with src/components/BoostSelectionModal.tsx
     */
    private function durationMultiplier(int $durationHours): float
    {
        $multipliers = config('boost.duration_multipliers', [
            6 => 1.0,
            12 => 1.75,
            24 => 2.8,
            72 => 6.2,
        ]);

        return (float) ($multipliers[$durationHours] ?? 1.0);
    }

    /**
     * Audience price, never below the configured baseline (EUR 1.00 by default).
     */
    private function priceCents(int $eligibleUsers, float $multiplier): int
    {
        $calculated = (int) round($eligibleUsers * $this->unitPriceCents() * $multiplier);
        $minimum = (int) config('boost.minimum_price_cents', 100);

        return max($minimum, $calculated);
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
     * Create a Stripe PaymentIntent for a boost. Returns client_secret for frontend confirmCardPayment.
     */
    public function createPaymentIntent(Request $request)
    {
        $request->validate([
            'feedType' => 'required|string|in:local,regional,national',
            'postId'   => 'required|string|max:255',
            'radiusKm' => 'required|numeric|min:0.1',
            'durationHours' => 'required|integer|in:6,12,24,72',
        ]);

        $userId = (string) Auth::id();
        if ($userId === '' || $userId === '0') {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $postId = (string) $request->input('postId');
        if (!Post::where('id', $postId)->where('user_id', $userId)->exists()) {
            return response()->json(['error' => 'Post not found'], 404);
        }

        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        $feedType = (string) $request->input('feedType');
        $currency = config('boost.currency', 'eur');

        $radiusKm = (float) $request->input('radiusKm');
        $durationHours = (int) $request->input('durationHours');
        $multiplier = $this->durationMultiplier($durationHours);

        $eligibleUsers = $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm);
        $priceCents = $this->priceCents($eligibleUsers, $multiplier);

        try {
            \Stripe\Stripe::setApiKey($secret);

            $intent = \Stripe\PaymentIntent::create([
                'amount'   => $priceCents,
                'currency' => $currency,
                'automatic_payment_methods' => ['enabled' => true],
                'metadata' => [
                    'post_id'   => $postId,
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
     * Estimate boost price based on radius targeting and duration multiplier.
     * Audience-size pricing: €0.05 (5 cents) per eligible user.
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

        $eligibleUsers = $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm);
        $priceCents = $this->priceCents($eligibleUsers, $multiplier);

        return response()->json([
            'currency' => config('boost.currency', 'eur'),
            'unitPriceCents' => $this->unitPriceCents(),
            'durationHours' => $durationHours,
            'durationMultiplier' => $multiplier,
            'feedType' => $feedType,
            'radiusKm' => $radiusKm,
            'eligibleUsersCount' => $eligibleUsers,
            'priceCents' => $priceCents,
            'priceEur' => $priceCents / 100,
        ]);
    }

    /**
     * Persist a boost for a verified, succeeded PaymentIntent.
     *
     * Idempotent by design: activation can arrive from the client redirect and from
     * the `payment_intent.succeeded` webhook, and Stripe may retry either. The
     * `payment_intent_id` unique index is the final backstop.
     *
     * Returns ['boost' => Boost, 'created' => bool].
     */
    private function persistBoostForIntent(\Stripe\PaymentIntent $intent, array $extra = []): array
    {
        $existing = Boost::where('payment_intent_id', $intent->id)->first();
        if ($existing) {
            return ['boost' => $existing, 'created' => false];
        }

        $metadata = $intent->metadata ?? [];
        $paidCents = (int) ($intent->amount_received ?: $intent->amount);
        $durationHours = (int) ($metadata->duration_hours ?? config('boost.default_duration_hours', 6));
        $now = now();

        try {
            $boost = Boost::create([
                'post_id'              => (string) $metadata->post_id,
                'user_id'              => (string) $metadata->user_id,
                'feed_type'            => (string) $metadata->feed_type,
                'price'                => round($paidCents / 100, 2),
                'radius_km'            => $metadata->radius_km ?? null,
                'center_local'         => $extra['centerLocal'] ?? null,
                'eligible_users_count' => $metadata->eligible_users_count ?? null,
                'duration_hours'       => $durationHours,
                'payment_intent_id'    => $intent->id,
                'activated_at'         => $now,
                'expires_at'           => $now->copy()->addHours($durationHours),
            ]);
        } catch (QueryException $e) {
            // Concurrent activation (client redirect + webhook) lost the unique race.
            $existing = Boost::where('payment_intent_id', $intent->id)->first();
            if ($existing) {
                return ['boost' => $existing, 'created' => false];
            }
            throw $e;
        }

        return ['boost' => $boost, 'created' => true];
    }

    /**
     * Activate a boost after successful Stripe payment. Verifies PaymentIntent with Stripe before persisting.
     */
    public function activate(Request $request)
    {
        $request->validate([
            'paymentIntentId' => 'required|string|max:255',
            'postId'         => 'required|string|max:255',
            'feedType'       => 'required|string|in:local,regional,national',
            'price'          => 'required|numeric|min:0',
            'radiusKm' => 'nullable|numeric|min:0',
            'eligibleUsersCount' => 'nullable|integer|min:0',
            'durationHours' => 'nullable|integer|in:6,12,24,72',
            'centerLocal' => 'nullable|string|max:200',
        ]);

        $userId = (string) Auth::id();
        if ($userId === '' || $userId === '0') {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!Post::where('id', $request->input('postId'))->where('user_id', $userId)->exists()) {
            return response()->json(['error' => 'Post not found'], 404);
        }

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

            ['boost' => $boost] = $this->persistBoostForIntent($intent, [
                'centerLocal' => $request->input('centerLocal'),
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
     * Stripe webhook: the authoritative activation path.
     *
     * The client redirect is best-effort — if the user closes the tab or the app is
     * killed after paying, the boost would never activate. Stripe retries failed
     * webhook deliveries, so this endpoint is what guarantees a paid boost exists.
     */
    public function stripeWebhook(Request $request)
    {
        $secret = config('services.stripe.secret');
        $webhookSecret = config('services.stripe.webhook_secret');

        if (empty($secret) || empty($webhookSecret)) {
            Log::error('Boost webhook called but Stripe webhook secret is not configured');
            return response()->json(['error' => 'Stripe webhook is not configured'], 500);
        }

        try {
            $event = \Stripe\Webhook::constructEvent(
                $request->getContent(),
                (string) $request->header('Stripe-Signature'),
                $webhookSecret,
                300
            );
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            Log::warning('Boost webhook signature verification failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Invalid signature'], 400);
        } catch (\Throwable $e) {
            Log::warning('Boost webhook payload rejected', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Invalid payload'], 400);
        }

        if ($event->type !== 'payment_intent.succeeded') {
            return response()->json(['received' => true, 'handled' => false]);
        }

        $intent = $event->data->object;
        $metadata = $intent->metadata ?? [];

        $postId = (string) ($metadata->post_id ?? '');
        $userId = (string) ($metadata->user_id ?? '');
        $feedType = (string) ($metadata->feed_type ?? '');

        // Metadata is set by createPaymentIntent, but verify it before trusting it.
        if ($postId === '' || $userId === '' || !in_array($feedType, ['local', 'regional', 'national'], true)) {
            Log::warning('Boost webhook missing boost metadata', ['intent' => $intent->id]);
            return response()->json(['error' => 'Missing boost metadata'], 422);
        }

        if (!Post::where('id', $postId)->where('user_id', $userId)->exists()) {
            Log::warning('Boost webhook post ownership mismatch', [
                'intent' => $intent->id,
                'postId' => $postId,
                'userId' => $userId,
            ]);
            return response()->json(['error' => 'Post not found'], 404);
        }

        try {
            ['boost' => $boost, 'created' => $created] = $this->persistBoostForIntent($intent);

            return response()->json([
                'received' => true,
                'handled'  => true,
                'created'  => $created,
                'boostId'  => $boost->id,
            ]);
        } catch (\Throwable $e) {
            // Non-2xx makes Stripe retry, which is what we want for transient faults.
            Log::error('Boost webhook activation failed', [
                'intent' => $intent->id,
                'error'  => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Activation failed'], 500);
        }
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
            $ids = Boost::active()
                ->forFeedType($feedType)
                ->pluck('post_id')
                ->unique()
                ->values()
                ->toArray();

            return response()->json(['postIds' => $ids]);
        } catch (\Throwable $e) {
            Log::warning('Boost activeIds failed (e.g. DB driver missing)', ['error' => $e->getMessage()]);
            return response()->json(['postIds' => []]);
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

        if (!$boost) {
            return response()->json([
                'hasBoost' => false,
                'isActive' => false,
                'postId' => $postId,
                'range' => $range,
                'analytics' => null,
            ]);
        }

        $fromTs = null;
        if ($range === '24h') {
            $fromTs = now()->subDay();
        } elseif ($range === '7d') {
            $fromTs = now()->subDays(7);
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
        $profileVisits = (int) $counts['profile_visit'];
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

        $price = (float) ($boost->price ?? 0);
        $costPerProfileVisit = $profileVisits > 0 ? round($price / $profileVisits, 4) : null;
        $costPerMessageStart = $messagesStarted > 0 ? round($price / $messagesStarted, 4) : null;

        return response()->json([
            'hasBoost' => true,
            'isActive' => $boost->expires_at->isFuture(),
            'postId' => $boost->post_id,
            'range' => $range,
            'feedType' => $boost->feed_type,
            'activatedAt' => optional($boost->activated_at)->toIso8601String(),
            'expiresAt' => optional($boost->expires_at)->toIso8601String(),
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
}
