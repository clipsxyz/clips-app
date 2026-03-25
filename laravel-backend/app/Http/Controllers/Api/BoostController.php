<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class BoostController extends Controller
{
    /** Boost duration in hours */
    const BOOST_DURATION_HOURS = 6;
    const BOOST_UNIT_PRICE_EUR_CENTS = 5; // €0.05 per eligible user

    /**
     * Duration multipliers used in the frontend.
     * Keep in sync with src/components/BoostSelectionModal.tsx
     */
    private function durationMultiplier(int $durationHours): float
    {
        return match ($durationHours) {
            6 => 1,
            12 => 1.75,
            24 => 2.8,
            72 => 6.2,
            default => 1,
        };
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
        if (!$row) return null;
        $coords = ['lat' => (float) $row->latitude, 'lng' => (float) $row->longitude];
        $cache[$label] = $coords;
        return $coords;
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
        $multiplier = $this->durationMultiplier($durationHours);

        $eligibleUsers = $this->estimateEligibleUsersCount($userId, $feedType, $radiusKm);
        $priceCents = (int) round($eligibleUsers * self::BOOST_UNIT_PRICE_EUR_CENTS * $multiplier);

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
        $priceCents = (int) round($eligibleUsers * self::BOOST_UNIT_PRICE_EUR_CENTS * $multiplier);

        return response()->json([
            'currency' => config('boost.currency', 'eur'),
            'unitPriceCents' => self::BOOST_UNIT_PRICE_EUR_CENTS,
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
}
