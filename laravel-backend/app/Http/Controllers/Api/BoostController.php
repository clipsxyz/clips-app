<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BoostController extends Controller
{
    /** Boost duration in hours */
    const BOOST_DURATION_HOURS = 6;

    /**
     * Create a Stripe PaymentIntent for a boost. Returns client_secret for frontend confirmCardPayment.
     */
    public function createPaymentIntent(Request $request)
    {
        $request->validate([
            'feedType' => 'required|string|in:local,regional,national',
            'postId'   => 'required|string|max:255',
        ]);

        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        $amountsCents = config('boost.amounts_cents', []);
        $feedType = $request->input('feedType');
        $amount = $amountsCents[$feedType] ?? 499; // default 4.99 EUR
        $currency = config('boost.currency', 'eur');

        try {
            \Stripe\Stripe::setApiKey($secret);

            $intent = \Stripe\PaymentIntent::create([
                'amount'   => $amount,
                'currency' => $currency,
                'automatic_payment_methods' => ['enabled' => true],
                'metadata' => [
                    'post_id'   => $request->input('postId'),
                    'feed_type' => $feedType,
                ],
            ]);

            return response()->json([
                'clientSecret' => $intent->client_secret,
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe PaymentIntent create failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
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

            if ($intent->metadata->post_id !== $request->input('postId') || $intent->metadata->feed_type !== $request->input('feedType')) {
                return response()->json(['error' => 'Payment metadata mismatch'], 400);
            }

            $now = now();
            $expiresAt = $now->copy()->addHours(self::BOOST_DURATION_HOURS);

            $boost = Boost::create([
                'post_id'          => $request->input('postId'),
                'user_id'          => $request->input('userId'),
                'feed_type'        => $request->input('feedType'),
                'price'            => $request->input('price'),
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
