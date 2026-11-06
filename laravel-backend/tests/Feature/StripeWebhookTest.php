<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StripeWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.stripe.webhook.secret' => self::SECRET]);
    }

    public function test_signed_checkout_completed_activates_a_pending_boost(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->create([
            'status' => 'pending',
            'duration_hours' => 12,
            'activated_at' => now()->subDay(),
            'expires_at' => now()->subHour(),
        ]);

        $payload = json_encode([
            'id' => 'evt_boost_activate',
            'object' => 'event',
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'id' => 'cs_boost_activate',
                    'object' => 'checkout.session',
                    'payment_status' => 'paid',
                    'metadata' => [
                        'boost_id' => (string) $boost->id,
                        'duration' => '12',
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, self::SECRET);

        $this->call(
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
        )->assertOk();

        $boost->refresh();
        $this->assertSame('active', $boost->status);
        $this->assertTrue($boost->expires_at->greaterThan(now()->addHours(11)));
        $this->assertTrue($boost->expires_at->lessThan(now()->addHours(13)));
    }
}
