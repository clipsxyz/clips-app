<?php

namespace App\Services;

use App\Models\Boost;
use App\Models\BoostTransaction;
use App\Models\Post;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BoostCheckoutActivator
{
    /**
     * Turn a paid Checkout Session into an active boost. Safe to call twice.
     *
     * @return array{status: string, post_id?: string, feed_type?: string, error?: string}
     */
    public function activatePaidSession(object $session): array
    {
        if (($session->payment_status ?? null) !== 'paid') {
            return ['status' => 'unpaid', 'error' => 'Payment is not complete'];
        }

        $metadata = $session->metadata ?? null;
        $postId = (string) ($metadata->post_id ?? '');
        $userId = (string) ($metadata->user_id ?? '');
        $radius = $metadata->radius ?? null;
        $tier = (string) ($metadata->tier ?? '');
        $duration = (int) ($metadata->duration ?? 0);
        $sessionId = (string) ($session->id ?? '');

        if ($postId === '' || $userId === '' || $tier === '' || $duration < 1) {
            Log::warning('Stripe checkout session is missing boost metadata', [
                'session_id' => $sessionId,
            ]);

            return ['status' => 'error', 'error' => 'Missing boost metadata'];
        }

        if ($sessionId !== '' && ($existingTx = BoostTransaction::query()->where('stripe_session_id', $sessionId)->first())) {
            $created = $this->ensureLiveBoost($existingTx, $this->paymentIntentId($session));

            return [
                'status' => 'success',
                'created' => $created,
                'post_id' => (string) $existingTx->post_id,
                'feed_type' => $this->feedTypeForTier((string) $existingTx->tier),
            ];
        }

        $post = Post::findOrFail($postId);
        if ((string) $post->user_id !== $userId) {
            Log::warning('Stripe boost metadata user does not own the post', [
                'session_id' => $sessionId,
                'post_id' => $postId,
            ]);

            return ['status' => 'error', 'error' => 'Post owner mismatch'];
        }

        $boostedUntil = now()->addHours($duration);
        $chargedCents = isset($session->amount_total) ? (int) $session->amount_total : 0;
        $quotedCents = (int) ($metadata->amount_cents ?? 0);
        $amountCents = $chargedCents > 0
            ? $chargedCents
            : ($quotedCents > 0 ? $quotedCents : BoostPricing::cents($tier, $duration));
        $feedType = $this->feedTypeForTier($tier);
        $paymentIntentId = $this->paymentIntentId($session);

        DB::transaction(function () use ($post, $boostedUntil, $radius, $tier, $sessionId, $userId, $duration, $amountCents, $session, $paymentIntentId) {
            $post->fill([
                'is_boosted' => true,
                'boosted_until' => $boostedUntil,
                'boost_radius' => $radius,
                'boost_tier' => $tier,
            ])->save();

            $transaction = BoostTransaction::query()->create([
                'stripe_session_id' => $sessionId,
                'post_id' => $post->id,
                'user_id' => $userId,
                'radius' => $radius,
                'tier' => $tier,
                'duration' => $duration,
                'amount_cents' => $amountCents,
                'currency' => isset($session->currency) ? (string) $session->currency : null,
                'paid_at' => now(),
            ]);

            $this->ensureLiveBoost($transaction, $paymentIntentId);
        });

        Log::info('Boost checkout completed', [
            'session_id' => $sessionId,
            'post_id' => (string) $post->id,
            'user_id' => $userId,
            'tier' => $tier,
            'duration' => $duration,
        ]);

        return [
            'status' => 'success',
            'created' => true,
            'post_id' => (string) $post->id,
            'feed_type' => $feedType,
        ];
    }

    /**
     * Turn a store receipt that Google or Apple already accepted into an active boost.
     * The reference is a hash of the purchase token, so a replay does not create a second boost.
     *
     * @return array{status: string, created: bool, post_id: string, feed_type: string}
     */
    public function activateVerifiedStorePurchase(
        string $userId,
        string $postId,
        string $tier,
        int $duration,
        float $radius,
        int $amountCents,
        string $platform,
        string $purchaseToken,
    ): array {
        $reference = $platform.':'.hash('sha256', $purchaseToken);
        if ($existing = BoostTransaction::query()->where('stripe_session_id', $reference)->first()) {
            return [
                'status' => 'success',
                'created' => $this->ensureLiveBoost($existing, null),
                'post_id' => (string) $existing->post_id,
                'feed_type' => $this->feedTypeForTier((string) $existing->tier),
            ];
        }

        $post = Post::findOrFail($postId);
        $boostedUntil = now()->addHours(max(1, $duration));
        $feedType = $this->feedTypeForTier($tier);

        DB::transaction(function () use ($post, $boostedUntil, $radius, $tier, $reference, $userId, $duration, $amountCents) {
            $post->fill([
                'is_boosted' => true,
                'boosted_until' => $boostedUntil,
                'boost_radius' => $radius,
                'boost_tier' => $tier,
            ])->save();

            $transaction = BoostTransaction::query()->create([
                'stripe_session_id' => $reference,
                'post_id' => $post->id,
                'user_id' => $userId,
                'radius' => $radius,
                'tier' => $tier,
                'duration' => $duration,
                'amount_cents' => $amountCents,
                'currency' => 'eur',
                'paid_at' => now(),
            ]);

            $this->ensureLiveBoost($transaction, null);
        });

        return [
            'status' => 'success',
            'created' => true,
            'post_id' => (string) $post->id,
            'feed_type' => $feedType,
        ];
    }

    /**
     * The payment row can exist without a boost when an earlier insert failed.
     * Returns true only when this call creates the live boost.
     */
    private function ensureLiveBoost(BoostTransaction $transaction, ?string $paymentIntentId): bool
    {
        $live = Boost::query()
            ->where('post_id', $transaction->post_id)
            ->where('user_id', $transaction->user_id)
            ->where('expires_at', '>', now())
            ->exists();
        if ($live) {
            return false;
        }

        $paidAt = $transaction->paid_at ?? now();
        $hours = max(1, (int) $transaction->duration);
        $expiresAt = $paidAt->copy()->addHours($hours);
        $tier = (string) $transaction->tier;

        Boost::query()->create([
            'post_id' => $transaction->post_id,
            'user_id' => $transaction->user_id,
            'feed_type' => $this->feedTypeForTier($tier),
            'status' => 'active',
            'price' => round(((int) $transaction->amount_cents) / 100, 2),
            'radius_km' => $transaction->radius,
            'duration_hours' => $hours,
            'payment_intent_id' => $paymentIntentId,
            'activated_at' => $paidAt,
            'expires_at' => $expiresAt,
        ]);

        Post::query()->whereKey($transaction->post_id)->update([
            'is_boosted' => true,
            'boosted_until' => $expiresAt,
            'boost_radius' => $transaction->radius,
            'boost_tier' => $tier,
        ]);

        return true;
    }

    private function feedTypeForTier(string $tier): string
    {
        return match ($tier) {
            'premium', 'regional' => 'regional',
            'featured', 'national' => 'national',
            default => 'local',
        };
    }

    private function paymentIntentId(object $session): ?string
    {
        $paymentIntent = $session->payment_intent ?? null;
        if (is_object($paymentIntent)) {
            $paymentIntent = $paymentIntent->id ?? null;
        }

        return is_string($paymentIntent) && $paymentIntent !== '' ? $paymentIntent : null;
    }
}
