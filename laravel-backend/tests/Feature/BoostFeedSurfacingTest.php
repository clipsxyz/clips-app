<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Boost surfacing, excluding the feed-ordering change (deliberately deferred).
 *
 * Covers: Sponsored flags on feed items, the boost center being persisted on the
 * webhook path, and /boost/active-ids being authenticated + radius-scoped.
 */
class BoostFeedSurfacingTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_SECRET = 'whsec_test_secret_for_boost_surfacing';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.stripe.secret' => 'sk_test_fake',
            'services.stripe.webhook_secret' => self::WEBHOOK_SECRET,
        ]);
    }

    private function seedCentroid(string $label, float $lat, float $lng): void
    {
        \DB::table('location_centroids')->updateOrInsert(
            ['label' => $label],
            ['latitude' => $lat, 'longitude' => $lng]
        );
    }

    private function makeUser(string $handle, ?string $local): User
    {
        return User::factory()->create([
            'handle' => $handle,
            'username' => $handle,
            'location_local' => $local,
            'location_regional' => $local,
            'location_national' => $local,
        ]);
    }

    private function boost(
        Post $post,
        User $booster,
        string $feedType = 'local',
        ?float $radiusKm = 25.0,
        ?string $centerLocal = 'Dublin',
        ?float $centerLat = null,
        ?float $centerLng = null,
        ?string $paymentIntentId = null
    ): Boost {
        return Boost::create([
            'post_id' => $post->id,
            'user_id' => $booster->id,
            'feed_type' => $feedType,
            'price' => 1.00,
            'radius_km' => $radiusKm,
            'center_local' => $centerLocal,
            'center_lat' => $centerLat,
            'center_lng' => $centerLng,
            'duration_hours' => 6,
            'payment_intent_id' => $paymentIntentId ?? 'pi_'.uniqid(),
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ]);
    }

    // -----------------------------------------------------------------
    // Item 1 — Sponsored flags on feed items
    // -----------------------------------------------------------------

    public function test_feed_marks_boosted_posts_and_leaves_others_unflagged(): void
    {
        $viewer = $this->makeUser('viewer_flags', 'Dublin');
        $booster = $this->makeUser('booster_flags', 'Dublin');
        $this->seedCentroid('Dublin', 53.3498, -6.2603);

        $boostedPost = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/a.mp4',
        ]);
        $plainPost = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/b.mp4',
        ]);

        $this->boost($boostedPost, $booster, feedType: 'regional');

        $items = collect($this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Dublin&limit=20')
            ->json('items'))
            ->keyBy('id');

        $this->assertTrue($items[$boostedPost->id]['isBoosted'], 'boosted post must be flagged');
        $this->assertSame('regional', $items[$boostedPost->id]['boostFeedType']);

        $this->assertFalse($items[$plainPost->id]['isBoosted'], 'ordinary post must not be flagged');
        $this->assertNull($items[$plainPost->id]['boostFeedType']);
    }

    public function test_feed_does_not_flag_expired_boosts(): void
    {
        $viewer = $this->makeUser('viewer_expired', 'Dublin');
        $booster = $this->makeUser('booster_expired', 'Dublin');
        $this->seedCentroid('Dublin', 53.3498, -6.2603);

        $post = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/a.mp4',
        ]);

        $boost = $this->boost($post, $booster);
        $boost->update(['expires_at' => now()->subMinute()]);

        $item = collect($this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Dublin&limit=20')
            ->json('items'))
            ->firstWhere('id', $post->id);

        $this->assertFalse($item['isBoosted'], 'an expired boost must not show as Sponsored');
    }

    public function test_every_feed_tab_carries_the_flags(): void
    {
        $viewer = $this->makeUser('viewer_tabs', 'Dublin');
        $booster = $this->makeUser('booster_tabs', 'Dublin');
        $this->seedCentroid('Dublin', 53.3498, -6.2603);

        $post = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/a.mp4',
        ]);
        $this->boost($post, $booster, feedType: 'local');
        \DB::table('user_follows')->insert([
            'follower_id' => $viewer->id,
            'following_id' => $booster->id,
            'status' => 'accepted',
        ]);

        foreach (['Dublin', 'Following'] as $filter) {
            $item = collect($this->actingAs($viewer, 'sanctum')
                ->getJson("/api/posts?filter={$filter}&limit=20")
                ->json('items'))
                ->firstWhere('id', $post->id);

            $this->assertNotNull($item, "post missing from {$filter} feed");
            $this->assertArrayHasKey('isBoosted', $item, "isBoosted missing on {$filter} feed");
            $this->assertArrayHasKey('boostFeedType', $item, "boostFeedType missing on {$filter} feed");
        }
    }

    // -----------------------------------------------------------------
    // Item 2 — center persisted on the webhook path
    // -----------------------------------------------------------------

    public function test_webhook_activation_persists_the_center_from_the_booster_record(): void
    {
        $this->seedCentroid('Cork', 51.8985, -8.4756);

        $booster = $this->makeUser('booster_center', 'Cork');
        $post = Post::factory()->create(['user_id' => $booster->id]);

        // createPaymentIntent sends no center in its metadata, and the webhook is
        // the authoritative activation path — it used to write center_local = NULL.
        // The webhook verifies the signature locally and never calls Stripe, so a
        // synthetic intent id exercises the real persist path.
        $intentId = 'pi_test_center_'.uniqid();

        $this->fireSucceededWebhook($booster, $post, $intentId, ['radius_km' => '25', 'duration_hours' => '6']);

        $boost = Boost::where('payment_intent_id', $intentId)->firstOrFail();

        $this->assertSame('Cork', $boost->center_local, 'webhook must persist the boost center');
        $this->assertNotNull($boost->center_lat, 'webhook must persist center_lat');
        $this->assertNotNull($boost->center_lng, 'webhook must persist center_lng');
        $this->assertEqualsWithDelta(51.8985, (float) $boost->center_lat, 0.01);
        $this->assertEqualsWithDelta(-8.4756, (float) $boost->center_lng, 0.01);
    }

    public function test_center_falls_back_to_regional_then_national(): void
    {
        $this->seedCentroid('Leinster', 53.1833, -6.8333);

        $booster = User::factory()->create([
            'handle' => 'booster_fallback',
            'username' => 'booster_fallback',
            'location_local' => null,
            'location_regional' => 'Leinster',
            'location_national' => 'Ireland',
        ]);
        $post = Post::factory()->create(['user_id' => $booster->id]);

        $intentId = 'pi_test_fallback_'.uniqid();

        $this->fireSucceededWebhook($booster, $post, $intentId, ['radius_km' => '25', 'duration_hours' => '6']);

        $this->assertSame('Leinster', Boost::where('payment_intent_id', $intentId)->firstOrFail()->center_local);
    }

    // -----------------------------------------------------------------
    // Item 3 — authenticated, radius-scoped activeIds
    // -----------------------------------------------------------------

    public function test_active_ids_requires_authentication(): void
    {
        $this->getJson('/api/boost/active-ids?feedType=local')->assertStatus(401);
    }

    public function test_active_ids_includes_boost_for_a_viewer_inside_the_radius(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $this->seedCentroid('Cork', 51.8985, -8.4756);

        $booster = $this->makeUser('booster_radius', 'Dublin');
        $post = Post::factory()->create(['user_id' => $booster->id]);
        $this->boost($post, $booster, radiusKm: 25.0, centerLocal: 'Dublin', centerLat: 53.3498, centerLng: -6.2603);

        $dublinViewer = $this->makeUser('viewer_dublin', 'Dublin');

        $res = $this->actingAs($dublinViewer, 'sanctum')
            ->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk();

        $this->assertContains($post->id, $res->json('postIds'));
    }

    public function test_active_ids_excludes_boost_for_a_viewer_outside_the_radius(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $this->seedCentroid('Cork', 51.8985, -8.4756);

        $booster = $this->makeUser('booster_far', 'Dublin');
        $post = Post::factory()->create(['user_id' => $booster->id]);
        $this->boost($post, $booster, radiusKm: 25.0, centerLocal: 'Dublin', centerLat: 53.3498, centerLng: -6.2603);

        // Cork is ~220km from Dublin — well outside a 25km radius.
        $corkViewer = $this->makeUser('viewer_cork', 'Cork');

        $res = $this->actingAs($corkViewer, 'sanctum')
            ->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk();

        $this->assertNotContains(
            $post->id,
            $res->json('postIds'),
            'a boost must not reach a viewer outside its radius'
        );
    }

    public function test_active_ids_ignores_expired_boosts(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $booster = $this->makeUser('booster_stale', 'Dublin');
        $post = Post::factory()->create(['user_id' => $booster->id]);

        $boost = $this->boost($post, $booster, radiusKm: 25.0, centerLocal: 'Dublin', centerLat: 53.3498, centerLng: -6.2603);
        $boost->update(['expires_at' => now()->subMinute()]);

        $viewer = $this->makeUser('viewer_stale', 'Dublin');

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk();

        $this->assertNotContains($post->id, $res->json('postIds'));
    }

    public function test_active_ids_keeps_boosts_without_a_recorded_radius(): void
    {
        // Nothing to enforce, so the Sponsored disclosure must survive.
        $booster = $this->makeUser('booster_noradius', null);
        $post = Post::factory()->create(['user_id' => $booster->id]);
        $this->boost($post, $booster, radiusKm: null, centerLocal: null);

        $viewer = $this->makeUser('viewer_noradius', 'Dublin');

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk();

        $this->assertContains($post->id, $res->json('postIds'));
    }

    public function test_active_ids_falls_back_to_resolving_the_center_label(): void
    {
        // Row shaped like a pre-migration boost: label only, no coordinates.
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $this->seedCentroid('Cork', 51.8985, -8.4756);

        $booster = $this->makeUser('booster_legacy', 'Dublin');
        $post = Post::factory()->create(['user_id' => $booster->id]);
        $this->boost($post, $booster, radiusKm: 25.0, centerLocal: 'Dublin', centerLat: null, centerLng: null);

        $corkViewer = $this->makeUser('viewer_legacy', 'Cork');
        $res = $this->actingAs($corkViewer, 'sanctum')
            ->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk();

        $this->assertNotContains($post->id, $res->json('postIds'), 'label fallback must still gate by radius');
    }

    // -----------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------

    /**
     * Drive the real webhook with a correctly signed payload. Mirrors the
     * signature scheme in BoostControllerTest.
     */
    private function fireSucceededWebhook(User $booster, Post $post, string $intentId, array $metadata = []): void
    {
        $secret = config('services.stripe.webhook_secret');
        $payload = json_encode([
            'id' => 'evt_test_'.uniqid(),
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => $intentId,
                    'object' => 'payment_intent',
                    'amount' => 100,
                    'amount_received' => 100,
                    'currency' => 'eur',
                    'status' => 'succeeded',
                    'metadata' => array_merge([
                        'post_id' => $post->id,
                        'user_id' => $booster->id,
                        'feed_type' => 'local',
                    ], $metadata),
                ],
            ],
        ]);

        $timestamp = time();
        $signature = hash_hmac('sha256', "$timestamp.$payload", $secret);

        $this->call(
            'POST',
            '/api/boost/stripe-webhook',
            [],
            [],
            [],
            ['HTTP_STRIPE_SIGNATURE' => "t=$timestamp,v1=$signature"],
            $payload
        )->assertOk();
    }
}
