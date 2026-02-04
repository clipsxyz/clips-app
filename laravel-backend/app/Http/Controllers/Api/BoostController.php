<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BoostController extends Controller
{
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
}
