<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use App\Services\StripeCheckoutSessionLookup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Stripe\Checkout\Session;
use Tests\TestCase;

class BoostExtendTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_paid_extension_adds_hours_to_the_current_expiry(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $started = now()->subHour();
        $expires = now()->addHours(5);
        $boost = Boost::factory()->forPost($post)->create([
            'activated_at' => $started,
            'expires_at' => $expires,
            'duration_hours' => 6,
            'radius_km' => 4,
            'eligible_users_count' => 220,
            'price' => 4.99,
        ]);
        Sanctum::actingAs($owner);

        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) use ($owner, $post) {
            $mock->shouldReceive('find')
                ->once()
                ->andReturn(Session::constructFrom([
                    'id' => 'cs_test_extend1',
                    'payment_status' => 'paid',
                    'amount_total' => 999,
                    'currency' => 'eur',
                    'metadata' => [
                        'user_id' => (string) $owner->id,
                        'post_id' => (string) $post->id,
                        'radius' => '4',
                        'tier' => 'standard',
                        'duration' => '12',
                        'action' => 'extend',
                        'eligible_users_count' => '220',
                    ],
                ]));
        });

        $this->postJson('/api/boosts/confirm-checkout', [
            'session_id' => 'cs_test_extend1',
        ])->assertOk()->assertJsonPath('extended', true);

        $boost->refresh();
        $this->assertSame(1, Boost::query()->where('post_id', $post->id)->count());
        $this->assertEquals(18, (int) $boost->duration_hours);
        $this->assertLessThan(2, abs($boost->activated_at->diffInSeconds($started)));
        $this->assertGreaterThan(11, $expires->diffInHours($boost->expires_at, false));
        $this->assertLessThan(2, abs($post->fresh()->boosted_until->diffInSeconds($boost->expires_at)));
    }

    public function test_a_second_boost_is_refused_while_one_is_still_running(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($post)->create([
            'expires_at' => now()->addHours(3),
        ]);
        Sanctum::actingAs($owner);
        $this->app['env'] = 'local';

        $this->postJson('/api/boosts/create-checkout-session', [
            'post_id' => $post->id,
            'radius' => 4,
            'tier' => 'standard',
            'duration' => 6,
            'gateway' => 'store',
        ])->assertStatus(409);

        $this->postJson('/api/boosts/create-checkout-session', [
            'post_id' => $post->id,
            'radius' => 4,
            'tier' => 'standard',
            'duration' => 12,
            'gateway' => 'store',
            'action' => 'extend',
        ])->assertOk()->assertJsonPath('metadata.action', 'extend');
    }

    public function test_status_reports_the_window_and_the_audience(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($post)->create([
            'activated_at' => now()->subHours(2),
            'expires_at' => now()->addHours(4),
            'duration_hours' => 6,
            'radius_km' => 3.5,
            'eligible_users_count' => 80,
            'impressions_count' => 17,
        ]);

        $this->getJson('/api/boost/status/'.$post->id)
            ->assertOk()
            ->assertJsonPath('isActive', true)
            ->assertJsonPath('durationHours', 6)
            ->assertJsonPath('viewsDelivered', 17)
            ->assertJsonPath('eligibleUsersCount', 80)
            ->assertJsonPath('radiusKm', 3.5);
    }
}
