<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\Post;
use App\Services\BoostCheckoutActivator;
use App\Services\BoostPricing;
use App\Services\BoostStoreProducts;
use App\Services\NativeStorePurchaseVerifier;
use App\Services\PushNotificationService;
use App\Services\StorePurchaseRejected;
use App\Services\StoreVerificationUnavailable;
use App\Services\StripeCheckoutSessionLookup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Checkout\Session;
use Stripe\Stripe;

class BoostCheckoutController extends Controller
{
    /**
     * Create a Stripe Checkout Session for a post boost.
     */
    public function createCheckoutSession(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'post_id' => 'required|uuid|exists:posts,id',
            'radius' => 'required|numeric|min:1',
            'tier' => 'required|string|in:standard,premium,featured',
            'duration' => 'required|integer|in:6,12,24,72',
            'gateway' => 'sometimes|string|in:stripe,store',
        ]);

        $post = Post::query()->findOrFail($validated['post_id']);
        if ((string) $post->user_id !== (string) $user->id) {
            return response()->json(['error' => 'You do not own this post'], 403);
        }

        $tier = (string) $validated['tier'];
        $radius = (float) $validated['radius'];
        $duration = (int) $validated['duration'];
        $gateway = (string) ($validated['gateway'] ?? 'stripe');
        $feedType = match ($tier) {
            'premium' => 'regional',
            'featured' => 'national',
            default => 'local',
        };
        $amount = app(BoostController::class)->audiencePriceCents((string) $user->id, $feedType, $radius, $duration, $gateway);
        if ($amount <= 0) {
            return response()->json(['error' => 'No audience for this boost'], 422);
        }

        $metadata = [
            'user_id' => (string) $user->id,
            'post_id' => (string) $post->id,
            'radius' => (string) $radius,
            'tier' => $tier,
            'duration' => (string) $duration,
            'amount_cents' => (string) $amount,
            'gateway' => $gateway,
        ];

        if ($gateway === 'store') {
            return response()->json([
                'gateway' => 'store',
                'amount_cents' => $amount,
                'amount_eur' => $amount / 100,
                'currency' => 'eur',
                'product_id' => \App\Services\BoostStoreProducts::sku($duration),
                'duration_hours' => $duration,
                'metadata' => $metadata,
            ]);
        }

        $secret = config('services.stripe.secret');
        if (! is_string($secret) || $secret === '') {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        Stripe::setApiKey($secret);

        try {
            $returnUrls = $this->localReturnUrls();
            $session = Session::create([
                'mode' => 'payment',
                'payment_method_types' => ['card'],
                'success_url' => $returnUrls['success_url'],
                'cancel_url' => $returnUrls['cancel_url'],
                'client_reference_id' => (string) $post->id,
                'line_items' => [[
                    'quantity' => 1,
                    'price_data' => [
                        'currency' => 'eur',
                        'unit_amount' => $amount,
                        'product_data' => [
                            'name' => 'Gazetteer Post Boost',
                            'description' => ucfirst($tier).' boost for '.$duration.' hours',
                        ],
                    ],
                ]],
                'metadata' => $metadata,
            ]);

            return response()->json([
                'gateway' => 'stripe',
                'checkout_url' => $session->url,
                'session_id' => $session->id,
                'amount_cents' => $amount,
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe Checkout session create failed', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Could not create checkout session'], 500);
        }
    }

    /**
     * Mark a sandbox or live Checkout Session active when the app returns.
     * Stripe cannot call the local webhook, so the return path confirms the payment.
     */
    public function confirmCheckout(
        Request $request,
        StripeCheckoutSessionLookup $sessions,
        BoostCheckoutActivator $activator,
    ): JsonResponse {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $sessionId = trim((string) $request->validate([
            'session_id' => 'required|string|max:255',
        ])['session_id']);

        try {
            $session = $sessions->find($sessionId);
        } catch (\Throwable $e) {
            Log::warning('Boost checkout confirm failed', [
                'session_id' => $sessionId,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Could not verify the payment'], 502);
        }

        $ownerId = (string) ($session->metadata->user_id ?? '');
        if ($ownerId === '' || $ownerId !== (string) $user->id) {
            return response()->json(['error' => 'This payment belongs to another account'], 403);
        }

        $result = $activator->activatePaidSession($session);
        if (($result['error'] ?? null) !== null) {
            return response()->json(['error' => $result['error']], 422);
        }

        return response()->json($result);
    }

    /**
     * Browser return URLs. APP_URL is the host the phone can reach
     * (LAN IP, or http://10.0.2.2:8000 on the Android emulator).
     *
     * @return array{success_url: string, cancel_url: string}
     */
    private function localReturnUrls(): array
    {
        $base = rtrim((string) config('app.url', 'http://127.0.0.1:8000'), '/');

        return [
            'success_url' => $base.'/boost/success?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $base.'/boost/cancel',
        ];
    }

    private function amountCents(string $tier, int $duration): int
    {
        return BoostPricing::cents($tier, $duration);
    }

    /**
     * Confirm a Google Play or App Store boost purchase, then turn the boost on.
     */
    public function verifyNativePurchase(
        Request $request,
        NativeStorePurchaseVerifier $verifier,
        BoostCheckoutActivator $activator,
        PushNotificationService $push,
    ): JsonResponse {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'platform' => 'required|string|in:android,ios',
            'product_id' => 'required|string|max:128',
            'purchase_token' => 'required_without:purchaseToken|string|max:8192',
            'purchaseToken' => 'required_without:purchase_token|string|max:8192',
            'transaction_id' => 'nullable|string|max:255',
            'receipt' => 'nullable|string',
            'receipt_data' => 'nullable|string',
            'post_id' => 'required|uuid|exists:posts,id',
            'radius' => 'required|numeric|min:1',
            'tier' => 'required|string|in:standard,premium,featured',
            'duration' => 'required|integer|in:6,12,24,72',
        ]);

        $duration = (int) $validated['duration'];
        $expectedSku = BoostStoreProducts::sku($duration);
        if ($expectedSku === null || $validated['product_id'] !== $expectedSku) {
            return response()->json(['error' => 'This product does not match the boost length'], 422);
        }

        $post = Post::query()->findOrFail($validated['post_id']);
        if ((string) $post->user_id !== (string) $user->id) {
            return response()->json(['error' => 'You do not own this post'], 403);
        }

        $purchaseToken = (string) ($validated['purchase_token'] ?? $validated['purchaseToken']);
        $receipt = $validated['receipt_data'] ?? $validated['receipt'] ?? null;

        try {
            $verifier->assertPurchased(
                (string) $validated['platform'],
                (string) $validated['product_id'],
                $purchaseToken,
                is_string($receipt) ? $receipt : null,
            );
        } catch (StoreVerificationUnavailable $e) {
            return response()->json(['error' => $e->getMessage()], 503);
        } catch (StorePurchaseRejected $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $tier = (string) $validated['tier'];
        $radius = (float) $validated['radius'];
        $feedType = match ($tier) {
            'premium' => 'regional',
            'featured' => 'national',
            default => 'local',
        };
        $amount = app(BoostController::class)->audiencePriceCents((string) $user->id, $feedType, $radius, $duration, 'store');
        $result = $activator->activateVerifiedStorePurchase(
            (string) $user->id,
            (string) $post->id,
            $tier,
            $duration,
            $radius,
            $amount,
            (string) $validated['platform'],
            $purchaseToken,
        );

        $boostId = Boost::query()
            ->where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->where('expires_at', '>', now())
            ->orderByDesc('id')
            ->value('id');
        if ($boostId === null) {
            return response()->json(['error' => 'The boost could not be activated'], 500);
        }

        if (($result['created'] ?? false) === true) {
            try {
                $push->sendToUser(
                    (string) $user->id,
                    'Post Boost Active! 🚀',
                    'Your post is now boosted across your chosen area.',
                    [
                        'type' => 'deep_link',
                        'route' => 'post',
                        'post_id' => (string) $post->id,
                        'boost_id' => (string) $boostId,
                    ],
                );
            } catch (\Throwable $e) {
                Log::error('Store boost push notification failed', [
                    'user_id' => (string) $user->id,
                    'post_id' => (string) $post->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'boost_id' => (int) $boostId,
            'created' => (bool) ($result['created'] ?? false),
            'post_id' => (string) $post->id,
            'feed_type' => $result['feed_type'] ?? $feedType,
        ]);
    }
}
