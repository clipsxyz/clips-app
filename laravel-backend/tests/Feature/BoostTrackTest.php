<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostTrackTest extends TestCase
{
    use RefreshDatabase;

    public function test_impression_and_unique_reach_are_recorded(): void
    {
        [$owner, $viewer, $boost] = $this->activeBoost();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'impression'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'reach'])
            ->assertOk();
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'reach'])
            ->assertOk();

        $this->assertSame(1, (int) $boost->fresh()->impressions_count);
        $this->assertSame(1, BoostAnalyticsEvent::query()->where('event_type', 'impression')->count());
        $this->assertSame(1, BoostAnalyticsEvent::query()->where('event_type', 'reach')->count());
        $this->assertSame(0, BoostAnalyticsEvent::query()->where('actor_user_id', $owner->id)->count());
    }

    public function test_click_is_recorded_and_the_owner_is_ignored(): void
    {
        [$owner, $viewer, $boost] = $this->activeBoost();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'click'])
            ->assertOk();
        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'click'])
            ->assertOk();

        $this->assertSame(1, BoostAnalyticsEvent::query()->where('event_type', 'click')->count());
    }

    public function test_unknown_event_is_rejected(): void
    {
        [, $viewer, $boost] = $this->activeBoost();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/boosts/{$boost->id}/track", ['event' => 'hover'])
            ->assertStatus(422);
    }

    /**
     * @return array{0: User, 1: User, 2: Boost}
     */
    private function activeBoost(): array
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);
        $boost = Boost::query()->create([
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'feed_type' => 'local',
            'price' => 4.99,
            'radius_km' => 5,
            'duration_hours' => 6,
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ]);

        return [$owner, $viewer, $boost];
    }
}
