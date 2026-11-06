<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\User;
use App\Services\BoostCheckoutActivator;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;
use UnexpectedValueException;

class StripeWebhookController extends Controller
{
    public function __construct(
        private readonly PushNotificationService $push,
        private readonly BoostCheckoutActivator $activator,
    ) {
    }

    public function handle(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = (string) $request->header('Stripe-Signature');

        try {
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                $this->webhookSecret()
            );
        } catch (SignatureVerificationException|UnexpectedValueException $e) {
            Log::warning('Stripe webhook rejected', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Invalid webhook signature'], 400);
        }

        if ($event->type !== 'checkout.session.completed') {
            return response()->json(['status' => 'success']);
        }

        $session = $event->data->object;
        if (($session->payment_status ?? null) !== 'paid') {
            return response()->json(['status' => 'success']);
        }

        $metadata = $session->metadata ?? null;
        $boostId = $metadata->boost_id ?? null;
        if ($boostId !== null && $boostId !== '') {
            $this->activateBoost((int) $boostId, $metadata);

            return response()->json(['status' => 'success']);
        }

        $result = $this->activator->activatePaidSession($session);
        if (($result['error'] ?? null) !== null) {
            $status = $result['error'] === 'Post owner mismatch' ? 400 : 400;

            return response()->json(['error' => $result['error']], $status);
        }

        if (($result['created'] ?? false) === true) {
            $this->notifyOwner($session);
        }

        return response()->json(['status' => 'success']);
    }

    private function activateBoost(int $boostId, object $metadata): void
    {
        $boost = Boost::query()->find($boostId);
        if (! $boost) {
            Log::warning('Stripe checkout session boost was not found', ['boost_id' => $boostId]);

            return;
        }

        $hours = (int) ($metadata->duration ?? $boost->duration_hours ?? 0);
        if ($hours < 1) {
            $hours = 6;
        }

        $boost->forceFill([
            'status' => 'active',
            'activated_at' => now(),
            'expires_at' => now()->addHours($hours),
        ])->save();
    }

    private function webhookSecret(): string
    {
        $secret = config('services.stripe.webhook.secret');
        if (! is_string($secret) || $secret === '') {
            $secret = config('services.stripe.webhook_secret');
        }

        return (string) $secret;
    }

    private function notifyOwner(object $session): void
    {
        try {
            $user = User::find($session->metadata->user_id ?? null);
            $token = is_string($user?->fcm_token) ? trim($user->fcm_token) : '';
            if (! $user || $token === '') {
                Log::warning('Boost push skipped, no FCM token', [
                    'user_id' => $session->metadata->user_id ?? null,
                    'post_id' => $session->metadata->post_id ?? null,
                ]);

                return;
            }

            $this->push->sendToToken(
                $token,
                'Post Boost Active! 🚀',
                'Your post is now boosted across your chosen area.',
                [
                    'type' => 'deep_link',
                    'route' => 'post',
                    'post_id' => (string) $session->metadata->post_id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Boost push notification failed', [
                'user_id' => $session->metadata->user_id ?? null,
                'post_id' => $session->metadata->post_id ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
