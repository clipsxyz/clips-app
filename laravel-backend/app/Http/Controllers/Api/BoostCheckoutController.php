<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Services\BoostCheckoutActivator;
use App\Services\BoostPricing;
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

        $secret = config('services.stripe.secret');
        if (! is_string($secret) || $secret === '') {
            return response()->json(['error' => 'Stripe is not configured'], 500);
        }

        Stripe::setApiKey($secret);

        $validated = $request->validate([
            'post_id' => 'required|uuid|exists:posts,id',
            'radius' => 'required|numeric|min:1',
            'tier' => 'required|string|in:standard,premium,featured',
            'duration' => 'required|integer|in:6,12,24,72',
        ]);

        $post = Post::query()->findOrFail($validated['post_id']);
        if ((string) $post->user_id !== (string) $user->id) {
            return response()->json(['error' => 'You do not own this post'], 403);
        }

        $tier = (string) $validated['tier'];
        $radius = (float) $validated['radius'];
        $duration = (int) $validated['duration'];
        $feedType = match ($tier) {
            'premium' => 'regional',
            'featured' => 'national',
            default => 'local',
        };
        $amount = app(BoostController::class)->audiencePriceCents((string) $user->id, $feedType, $radius, $duration);
        if ($amount <= 0) {
            return response()->json(['error' => 'No audience for this boost'], 422);
        }

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
                'metadata' => [
                    'user_id' => (string) $user->id,
                    'post_id' => (string) $post->id,
                    'radius' => (string) $radius,
                    'tier' => $tier,
                    'duration' => (string) $duration,
                    'amount_cents' => (string) $amount,
                ],
            ]);

            return response()->json([
                'checkout_url' => $session->url,
                'session_id' => $session->id,
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
}
