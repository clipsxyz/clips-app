<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostMetric;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostMetricTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_metrics_belong_to_a_boost_and_ctr_updates(): void
    {
        $boost = $this->boost();
        $metric = BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'impressions' => 4,
            'reach' => 3,
            'clicks' => 1,
            'date' => '2026-11-06',
        ]);

        $boost->recalculateCtrForDate('2026-11-06');

        $this->assertSame(25.0, $metric->fresh()->ctr);
        $this->assertTrue($boost->metrics()->whereKey($metric->id)->exists());
        $this->assertSame($boost->id, $metric->boost->id);
    }

    public function test_one_metric_row_per_boost_per_day(): void
    {
        $boost = $this->boost();
        BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'date' => '2026-11-06',
        ]);

        $this->expectException(QueryException::class);
        BoostMetric::query()->create([
            'boost_id' => $boost->id,
            'date' => '2026-11-06',
        ]);
    }

    private function boost(): Boost
    {
        $owner = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);

        return Boost::query()->create([
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'feed_type' => 'local',
            'price' => 4.99,
            'radius_km' => 5,
            'duration_hours' => 6,
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ]);
    }
}
