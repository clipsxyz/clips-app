<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class StripeWebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.stripe.webhook.secret' => self::SECRET,
            'services.stripe.webhook_secret' => self::SECRET,
        ]);
    }

    public function test_invalid_signature_is_rejected(): void
    {
        $this->mock(PushNotificationService::class)->shouldNotReceive('sendToToken');

        $this->call(
            'POST',
            '/api/webhooks/stripe',
            [],
            [],
            [],
            [
                'HTTP_STRIPE_SIGNATURE' => 't=1,v1=deadbeef',
                'CONTENT_TYPE' => 'application/json',
            ],
            '{"id":"evt_bad","object":"event","type":"checkout.session.completed","data":{"object":{}}}'
        )->assertStatus(400);
    }

    public function test_paid_checkout_activates_the_boost_and_notifies_the_owner(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        DB::table('fcm_tokens')->insert([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'token' => 'device-token-boost',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->mock(PushNotificationService::class)
            ->shouldReceive('sendToToken')
            ->once()
            ->with(
                'device-token-boost',
                'Post Boost Active! 🚀',
                'Your post is now boosted across your chosen area.',
                [
                    'type' => 'deep_link',
                    'route' => 'post',
                    'post_id' => (string) $post->id,
                ]
            );

        $payload = $this->eventPayload($post->id, $user->id);

        $this->signed($payload)
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $post->refresh();
        $this->assertTrue($post->is_boosted);
        $this->assertSame('premium', $post->boost_tier);
        $this->assertEquals(8.0, (float) $post->boost_radius);
        $this->assertTrue($post->boosted_until->greaterThan(now()->addHours(11)));
        $this->assertTrue($post->boosted_until->lessThan(now()->addHours(13)));

        $this->assertDatabaseHas('boost_transactions', [
            'stripe_session_id' => 'cs_test_paid123',
            'post_id' => $post->id,
            'user_id' => $user->id,
            'tier' => 'premium',
            'duration' => 12,
            'amount_cents' => 999,
        ]);
        $this->assertDatabaseHas('boosts', [
            'post_id' => $post->id,
            'user_id' => $user->id,
            'feed_type' => 'regional',
            'duration_hours' => 12,
        ]);

        $this->signed($payload)->assertOk();
        $this->assertSame(1, \App\Models\BoostTransaction::query()->count());
    }

    public function test_push_failure_still_acknowledges_the_webhook(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        DB::table('fcm_tokens')->insert([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'token' => 'stale-token',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $logged = false;
        Log::listen(function ($log) use (&$logged) {
            if ($log->level === 'error' && $log->message === 'Boost push notification failed') {
                $logged = true;
            }
        });

        $this->mock(PushNotificationService::class)
            ->shouldReceive('sendToToken')
            ->once()
            ->andThrow(new \RuntimeException('stale token'));

        $this->signed($this->eventPayload($post->id, $user->id))
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertTrue($logged);
        $this->assertTrue($post->refresh()->is_boosted);
    }

    private function signed(string $payload)
    {
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, self::SECRET);

        return $this->call(
            'POST',
            '/api/webhooks/stripe',
            [],
            [],
            [],
            [
                'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
                'CONTENT_TYPE' => 'application/json',
            ],
            $payload
        );
    }

    private function eventPayload(string $postId, string $userId): string
    {
        return json_encode([
            'id' => 'evt_test_boost',
            'object' => 'event',
            'api_version' => '2024-06-20',
            'created' => time(),
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'id' => 'cs_test_paid123',
                    'object' => 'checkout.session',
                    'payment_status' => 'paid',
                    'amount_total' => 999,
                    'currency' => 'eur',
                    'payment_intent' => 'pi_test_boost',
                    'metadata' => [
                        'post_id' => $postId,
                        'user_id' => $userId,
                        'radius' => '8',
                        'tier' => 'premium',
                        'duration' => '12',
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);
    }
}
