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

class BoostGoalAndPauseTest extends TestCase
{
    use RefreshDatabase;

    public function test_pause_holds_the_remaining_time_and_resume_continues_it(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create([
            'is_boosted' => true,
            'boosted_until' => now()->addHours(5),
        ]);
        $boost = Boost::factory()->forPost($post)->create([
            'goal' => 'profile_visits',
            'status' => 'active',
            'activated_at' => now()->subHour(),
            'expires_at' => now()->addHours(5),
            'duration_hours' => 6,
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/boosts/{$post->id}/delivery", ['action' => 'pause'])
            ->assertOk()
            ->assertJsonPath('paused', true)
            ->assertJsonPath('goal', 'profile_visits');

        $this->assertFalse(Boost::active()->whereKey($boost->id)->exists());
        $boost->refresh();
        $held = (int) $boost->paused_remaining_seconds;
        $this->assertGreaterThan(4 * 3600, $held);

        $this->travel(2)->hours();

        $this->postJson("/api/boosts/{$post->id}/delivery", ['action' => 'resume'])
            ->assertOk()
            ->assertJsonPath('paused', false)
            ->assertJsonPath('isActive', true);

        $boost->refresh();
        $this->assertSame('active', $boost->status);
        $this->assertNull($boost->paused_at);
        $left = $boost->expires_at->getTimestamp() - now()->getTimestamp();
        $this->assertEqualsWithDelta($held, $left, 5);
        $this->assertTrue(Boost::active()->whereKey($boost->id)->exists());
    }

    public function test_stop_ends_delivery_and_leaves_the_post(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create([
            'is_boosted' => true,
            'boosted_until' => now()->addHours(4),
        ]);
        $boost = Boost::factory()->forPost($post)->create([
            'expires_at' => now()->addHours(4),
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/boosts/{$post->id}/delivery", ['action' => 'stop'])
            ->assertOk()
            ->assertJsonPath('stopped', true)
            ->assertJsonPath('isActive', false);

        $boost->refresh();
        $post->refresh();
        $this->assertSame('stopped', $boost->status);
        $this->assertFalse($boost->expires_at->isFuture());
        $this->assertFalse((bool) $post->is_boosted);
        $this->assertNotNull(Post::query()->find($post->id));
        $this->assertFalse(Boost::active()->whereKey($boost->id)->exists());

        $this->postJson("/api/boosts/{$post->id}/delivery", ['action' => 'pause'])
            ->assertStatus(409);
    }

    public function test_a_paid_boost_stores_the_selected_goal(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Sanctum::actingAs($owner);

        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) use ($owner, $post) {
            $mock->shouldReceive('find')
                ->once()
                ->andReturn(Session::constructFrom([
                    'id' => 'cs_test_goal1',
                    'payment_status' => 'paid',
                    'amount_total' => 499,
                    'currency' => 'eur',
                    'metadata' => [
                        'user_id' => (string) $owner->id,
                        'post_id' => (string) $post->id,
                        'radius' => '3',
                        'tier' => 'standard',
                        'duration' => '6',
                        'action' => 'create',
                        'goal' => 'messages',
                        'eligible_users_count' => '80',
                    ],
                ]));
        });

        $this->postJson('/api/boosts/confirm-checkout', [
            'session_id' => 'cs_test_goal1',
        ])->assertOk();

        $boost = Boost::query()->where('post_id', $post->id)->first();
        $this->assertNotNull($boost);
        $this->assertSame('messages', $boost->goal);
        $this->assertSame(80, (int) $boost->eligible_users_count);

        $this->getJson("/api/boost/status/{$post->id}")
            ->assertOk()
            ->assertJsonPath('goal', 'messages')
            ->assertJsonPath('paused', false);
    }
}
