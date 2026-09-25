<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private function signIn(): User
    {
        $this->user = User::factory()->create(['handle' => '@boostuser']);
        $this->actingAs($this->user, 'sanctum');
        return $this->user;
    }

    public function test_estimate_rejects_invalid_feed_type(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'galaxy',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertStatus(422);
    }

    public function test_estimate_rejects_invalid_duration(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 5,
        ])->assertStatus(422);
    }

    public function test_estimate_rejects_zero_radius(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 0,
            'durationHours' => 6,
        ])->assertStatus(422);
    }

    public function test_estimate_returns_price_cents_for_valid_input(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertOk()
            ->assertJsonStructure([
                'eligibleUsersCount',
                'priceCents',
                'priceEur',
            ]);
    }

    public function test_active_ids_returns_empty_without_boosts(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk()
            ->assertJsonStructure(['postIds' => []]);
    }

    public function test_active_ids_rejects_invalid_feed_type(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/active-ids?feedType=galaxy')
            ->assertStatus(400)
            ->assertJson(['error' => 'Invalid feed type']);
    }

    public function test_status_returns_inactive_for_unknown_post(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/status/unknown-post')
            ->assertOk()
            ->assertJson([
                'isActive' => false,
                'timeRemaining' => 0,
                'feedType' => null,
                'activatedAt' => null,
                'expiresAt' => null,
            ]);
    }

    public function test_status_requires_a_post_id(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/status/')
            ->assertStatus(404);
    }

    public function test_estimate_is_available_without_auth(): void
    {
        $user = User::factory()->create(['handle' => '@anonbooster']);

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertOk()
            ->assertJsonStructure([
                'eligibleUsersCount',
                'priceCents',
                'priceEur',
            ]);
    }

    public function test_create_payment_intent_requires_authentication(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->postJson('/api/boost/create-payment-intent', [
            'postId' => $post->id,
            'feedType' => 'local',
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertStatus(401);
    }

    public function test_create_payment_intent_rejects_a_post_the_caller_does_not_own(): void
    {
        $this->signIn();
        $other = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $other->id, 'user_handle' => $other->handle]);

        $this->postJson('/api/boost/create-payment-intent', [
            'postId' => $post->id,
            'feedType' => 'local',
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertStatus(404)
            ->assertJson(['error' => 'Post not found']);
    }

    public function test_create_payment_intent_reports_missing_stripe_configuration(): void
    {
        $this->signIn();
        config(['services.stripe.secret' => null]);

        $post = Post::factory()->create([
            'user_id' => $this->user->id,
            'user_handle' => $this->user->handle,
        ]);

        $this->postJson('/api/boost/create-payment-intent', [
            'postId' => $post->id,
            'feedType' => 'local',
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertStatus(500)
            ->assertJson(['error' => 'Stripe is not configured']);
    }

    public function test_activate_requires_authentication(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->postJson('/api/boost/activate', [
            'paymentIntentId' => 'pi_test_123',
            'postId' => $post->id,
            'feedType' => 'local',
            'price' => 5,
        ])->assertStatus(401);
    }

    public function test_activate_rejects_a_post_the_caller_does_not_own(): void
    {
        $this->signIn();
        $other = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $other->id, 'user_handle' => $other->handle]);

        $this->postJson('/api/boost/activate', [
            'paymentIntentId' => 'pi_test_123',
            'postId' => $post->id,
            'feedType' => 'local',
            'price' => 5,
        ])->assertStatus(404)
            ->assertJson(['error' => 'Post not found']);
    }

    public function test_estimate_charges_one_euro_when_audience_is_empty(): void
    {
        $this->signIn();
        config(['boost.minimum_price_cents' => 100, 'boost.unit_price_cents' => 5]);

        $booster = User::factory()->create([
            'handle' => '@nobodynearby',
            'location_local' => null,
            'location_regional' => null,
            'location_national' => null,
        ]);

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $booster->id,
            'radiusKm' => 2,
            'durationHours' => 6,
        ])->assertOk()
            ->assertJson([
                'eligibleUsersCount' => 0,
                'priceCents' => 100,
                'priceEur' => 1,
            ]);
    }

    public function test_prices_endpoint_exposes_audience_pricing(): void
    {
        $this->getJson('/api/boost/prices')
            ->assertOk()
            ->assertJsonStructure([
                'currency',
                'unitPriceCents',
                'durationMultipliers',
            ]);
    }

    public function test_estimate_pricing_matches_configured_unit_price(): void
    {
        $this->signIn();
        config(['boost.unit_price_cents' => 5]);

        $booster = User::factory()->create([
            'handle' => '@galwaybooster',
            'location_local' => 'Galway',
        ]);
        User::factory()->create(['handle' => '@galwayneighbour', 'location_local' => 'Galway']);

        $response = $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $booster->id,
            'radiusKm' => 50,
            'durationHours' => 6,
        ])->assertOk();

        $body = json_decode($response->getContent(), true);
        $this->assertSame(5, $body['unitPriceCents']);
        $minimum = (int) config('boost.minimum_price_cents');
        $this->assertSame(
            max($minimum, $body['eligibleUsersCount'] * 5),
            $body['priceCents']
        );
    }

    // ---------------------------------------------------------------------
    // Stripe webhook (authoritative activation path)
    // ---------------------------------------------------------------------

    private const WEBHOOK_SECRET = 'whsec_test_secret_for_boosts';

    /**
     * Build a Stripe-Signature header exactly as Stripe does, so signature
     * verification runs for real instead of being bypassed.
     */
    private function stripeSignature(string $payload, ?int $timestamp = null, ?string $secret = null): string
    {
        $timestamp ??= time();
        $secret ??= self::WEBHOOK_SECRET;
        $signature = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);

        return "t={$timestamp},v1={$signature}";
    }

    private function paymentIntentSucceededPayload(array $metadata, string $intentId = 'pi_boost_123'): string
    {
        return json_encode([
            'id' => 'evt_test_' . uniqid(),
            'object' => 'event',
            'api_version' => '2024-06-20',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => $intentId,
                    'object' => 'payment_intent',
                    'amount' => 500,
                    'amount_received' => 500,
                    'currency' => 'eur',
                    'status' => 'succeeded',
                    'metadata' => $metadata,
                ],
            ],
        ]);
    }

    private function configureStripe(): void
    {
        config([
            'services.stripe.secret' => 'sk_test_fake',
            'services.stripe.webhook_secret' => self::WEBHOOK_SECRET,
        ]);
    }

    private function sendWebhook(string $payload, ?string $signature = null)
    {
        return $this->call(
            'POST',
            '/api/boost/stripe-webhook',
            [],
            [],
            [],
            ['HTTP_STRIPE_SIGNATURE' => $signature ?? $this->stripeSignature($payload)],
            $payload
        );
    }

    private function ownedPostMetadata(User $user, array $overrides = []): array
    {
        return array_merge([
            'post_id' => (string) Post::factory()->create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
            ])->id,
            'user_id' => (string) $user->id,
            'feed_type' => 'local',
            'radius_km' => '50',
            'duration_hours' => '6',
            'eligible_users_count' => '12',
        ], $overrides);
    }

    public function test_webhook_rejects_request_when_not_configured(): void
    {
        config(['services.stripe.secret' => null, 'services.stripe.webhook_secret' => null]);

        $payload = $this->paymentIntentSucceededPayload($this->ownedPostMetadata(
            User::factory()->create(['handle' => '@unconfigured'])
        ));

        $this->sendWebhook($payload)->assertStatus(500);
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        $this->configureStripe();
        $user = User::factory()->create(['handle' => '@badsignature']);
        $payload = $this->paymentIntentSucceededPayload($this->ownedPostMetadata($user));

        $this->sendWebhook($payload, 't=123,v1=deadbeef')->assertStatus(400);

        $this->assertDatabaseCount('boosts', 0);
    }

    public function test_webhook_rejects_tampered_payload(): void
    {
        $this->configureStripe();
        $user = User::factory()->create(['handle' => '@tampered']);
        $metadata = $this->ownedPostMetadata($user);

        $signature = $this->stripeSignature($this->paymentIntentSucceededPayload($metadata));

        // Amount is rewritten after signing — the signature must no longer verify.
        $tampered = str_replace('"amount":500', '"amount":1', $this->paymentIntentSucceededPayload($metadata, 'pi_tampered'));

        $this->sendWebhook($tampered, $signature)->assertStatus(400);

        $this->assertDatabaseCount('boosts', 0);
    }

    public function test_webhook_activates_boost_on_payment_intent_succeeded(): void
    {
        $this->configureStripe();
        $user = User::factory()->create(['handle' => '@webhookbooster']);
        $metadata = $this->ownedPostMetadata($user);

        $this->sendWebhook($this->paymentIntentSucceededPayload($metadata))
            ->assertOk()
            ->assertJson(['received' => true, 'handled' => true, 'created' => true]);

        $this->assertDatabaseCount('boosts', 1);
        $this->assertDatabaseHas('boosts', [
            'post_id' => $metadata['post_id'],
            'user_id' => (string) $user->id,
            'feed_type' => 'local',
            'payment_intent_id' => 'pi_boost_123',
        ]);
    }

    public function test_webhook_is_idempotent_across_stripe_retries(): void
    {
        $this->configureStripe();
        $user = User::factory()->create(['handle' => '@retriedbooster']);
        $metadata = $this->ownedPostMetadata($user);

        // Stripe retries the exact same event, and so should our own replay handling.
        $payload = $this->paymentIntentSucceededPayload($metadata);

        $this->sendWebhook($payload)->assertOk()->assertJson(['created' => true]);
        $this->sendWebhook($payload)->assertOk()->assertJson(['created' => false]);

        $this->assertDatabaseCount('boosts', 1);
    }

    public function test_webhook_rejects_post_not_owned_by_metadata_user(): void
    {
        $this->configureStripe();
        $booster = User::factory()->create(['handle' => '@metadataowner']);
        $other = User::factory()->create(['handle' => '@somebodyelse']);
        $someoneElsesPost = (string) Post::factory()->create([
            'user_id' => $other->id,
            'user_handle' => $other->handle,
        ])->id;

        $payload = $this->paymentIntentSucceededPayload([
            'post_id' => $someoneElsesPost,
            'user_id' => (string) $booster->id,
            'feed_type' => 'local',
            'duration_hours' => '6',
        ]);

        $this->sendWebhook($payload)->assertStatus(404);

        $this->assertDatabaseCount('boosts', 0);
    }

    public function test_webhook_rejects_payload_without_boost_metadata(): void
    {
        $this->configureStripe();

        $payload = $this->paymentIntentSucceededPayload(['order_id' => 'unrelated']);

        $this->sendWebhook($payload)->assertStatus(422);

        $this->assertDatabaseCount('boosts', 0);
    }

    public function test_webhook_ignores_unrelated_event_types(): void
    {
        $this->configureStripe();
        $user = User::factory()->create(['handle' => '@otherEvent']);
        $metadata = $this->ownedPostMetadata($user);

        $payload = json_encode([
            'id' => 'evt_other',
            'object' => 'event',
            'type' => 'charge.refunded',
            'data' => ['object' => ['id' => 'ch_123', 'metadata' => $metadata]],
        ]);

        $this->sendWebhook($payload)->assertOk()->assertJson(['handled' => false]);

        $this->assertDatabaseCount('boosts', 0);
    }

    public function test_payment_intent_id_is_unique_in_the_database(): void
    {
        $user = User::factory()->create(['handle' => '@uniquebackstop']);
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $attributes = [
            'post_id' => (string) $post->id,
            'user_id' => (string) $user->id,
            'feed_type' => 'local',
            'price' => 5,
            'payment_intent_id' => 'pi_unique_backstop',
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ];

        Boost::create($attributes);

        $this->expectException(QueryException::class);
        Boost::create($attributes);
    }
}
