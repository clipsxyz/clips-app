<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostMetric;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostPerformanceAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_receives_totals_and_recent_daily_rows(): void
    {
        [$owner, $boost] = $this->boost();
        BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'impressions' => 40,
            'reach' => 25,
            'clicks' => 4,
            'ctr' => 10,
            'date' => now()->toDateString(),
        ]);
        BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'impressions' => 10,
            'reach' => 8,
            'clicks' => 1,
            'ctr' => 10,
            'date' => now()->subDay()->toDateString(),
        ]);
        BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'impressions' => 100,
            'reach' => 80,
            'clicks' => 5,
            'ctr' => 5,
            'date' => now()->subDays(10)->toDateString(),
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/boosts/{$boost->id}/analytics?days=7")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.boost_id', $boost->id)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.summary.impressions', 150)
            ->assertJsonPath('data.summary.reach', 113)
            ->assertJsonPath('data.summary.clicks', 10)
            ->assertJsonPath('data.summary.ctr', 6.67)
            ->assertJsonCount(2, 'data.daily')
            ->assertJsonPath('data.daily.0.date', now()->toDateString());

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/boosts/{$boost->id}/analytics?days=30")
            ->assertOk()
            ->assertJsonCount(3, 'data.daily');
    }

    public function test_ctr_is_zero_when_there_are_no_impressions(): void
    {
        [$owner, $boost] = $this->boost();

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/boosts/{$boost->id}/analytics")
            ->assertOk()
            ->assertJsonPath('data.summary.impressions', 0)
            ->assertJsonPath('data.summary.ctr', 0)
            ->assertJsonCount(0, 'data.daily');
    }

    public function test_another_user_is_forbidden(): void
    {
        [, $boost] = $this->boost();
        $stranger = User::factory()->create();

        $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/boosts/{$boost->id}/analytics")
            ->assertForbidden();
    }

    /**
     * @return array{0: User, 1: Boost}
     */
    private function boost(): array
    {
        $owner = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $owner->id,
            'user_handle' => $owner->handle,
        ]);
        $boost = Boost::query()->create([
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'feed_type' => 'local',
            'price' => 4.99,
            'radius_km' => 5,
            'duration_hours' => 6,
            'activated_at' => now()->subHour(),
            'expires_at' => now()->addHours(5),
        ]);

        return [$owner, $boost];
    }
}
