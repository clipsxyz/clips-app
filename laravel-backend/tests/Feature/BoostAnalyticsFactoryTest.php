<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\BoostAnalyticsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostAnalyticsFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_active_boost_can_be_created_with_metrics_for_its_post(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->boosted()->create();
        $boost = Boost::query()->where('post_id', $post->id)->first();

        $this->assertNotNull($boost);
        $this->assertTrue($boost->expires_at->isFuture());
        $this->assertSame($owner->id, $boost->user_id);
        $this->assertSame(1, $boost->metrics()->count());
        $this->assertSame(
            round(($boost->metrics()->first()->clicks / $boost->metrics()->first()->impressions) * 100, 2),
            (float) $boost->metrics()->first()->ctr
        );
    }

    public function test_boost_analytics_seeder_creates_a_week_of_metrics(): void
    {
        $this->seed(BoostAnalyticsSeeder::class);

        $boost = Boost::query()->first();
        $this->assertNotNull($boost);
        $this->assertTrue($boost->expires_at->isFuture());
        $this->assertSame(7, $boost->metrics()->count());
        $this->assertSame($boost->post->user_id, $boost->user_id);
    }
}
