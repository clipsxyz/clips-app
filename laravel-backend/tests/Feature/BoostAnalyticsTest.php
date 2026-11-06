<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostMetric;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Checks the boost analytics pipeline from tracked feed events through to the
 * owner-only summary endpoint.
 *
 * RefreshDatabase rebuilds the database before every test, so each case starts
 * from an empty slate and cannot see rows created by another test.
 */
class BoostAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Sending impression and click events updates today's boost_metrics row
     * and stores CTR as clicks divided by impressions, as a percentage.
     */
    public function test_tracking_endpoint_increments_metrics_and_calculates_ctr(): void
    {
        // Database setup: an owner, one of their posts, and a boost that is still active.
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->active()->create();

        // A different signed-in viewer records the events. The owner's own views
        // are ignored so they do not inflate their boost.
        $viewer = User::factory()->create();
        Sanctum::actingAs($viewer);

        // HTTP requests: four times the post was seen, and two times it was opened.
        foreach (range(1, 4) as $ignored) {
            $this->postJson("/api/boosts/{$boost->id}/track", ['event' => 'impression'])
                ->assertOk();
        }

        foreach (range(1, 2) as $ignored) {
            $this->postJson("/api/boosts/{$boost->id}/track", ['event' => 'click'])
                ->assertOk();
        }

        // Assertions: one daily row holds those totals. CTR is 2 / 4 * 100 = 50.
        $this->assertDatabaseHas('boost_metrics', [
            'boost_id' => $boost->id,
            'date' => now()->startOfDay()->toDateTimeString(),
            'impressions' => 4,
            'clicks' => 2,
            'ctr' => 50,
        ]);

        $metric = $boost->metrics()->first();
        $expectedCtr = round(((int) $metric->clicks / (int) $metric->impressions) * 100, 2);
        $this->assertSame(50.0, $expectedCtr);
        $this->assertSame($expectedCtr, (float) $metric->ctr);
    }

    /**
     * The post owner can load aggregated totals and the per-day breakdown
     * from GET /api/boosts/{boost}/analytics.
     */
    public function test_user_can_fetch_boost_analytics_summary(): void
    {
        // Database setup: the same owner, post, and active boost used by the dashboard.
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->active()->create([
            'price' => 12.5,
        ]);

        // Seed two days of metrics. Together they are 300 impressions, 230 reach, and 30 clicks.
        BoostMetric::factory()->create([
            'boost_id' => $boost->id,
            'date' => now()->toDateString(),
            'impressions' => 200,
            'reach' => 150,
            'clicks' => 20,
        ]);
        BoostMetric::factory()->create([
            'boost_id' => $boost->id,
            'date' => now()->subDay()->toDateString(),
            'impressions' => 100,
            'reach' => 80,
            'clicks' => 10,
        ]);

        // Sign in as the post owner. Sanctum is the API guard this route requires.
        Sanctum::actingAs($owner);

        // HTTP request and assertions: 200, with summary totals and a daily list.
        // Overall CTR is 30 / 300 * 100 = 10. The newest day is listed first.
        $this->getJson("/api/boosts/{$boost->id}/analytics")
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'boost_id',
                    'status',
                    'summary' => ['impressions', 'reach', 'clicks', 'ctr'],
                    'daily' => [
                        '*' => ['date', 'impressions', 'reach', 'clicks', 'ctr'],
                    ],
                ],
            ])
            ->assertJsonPath('data.spend', 12.5)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.summary.impressions', 300)
            ->assertJsonPath('data.summary.reach', 230)
            ->assertJsonPath('data.summary.clicks', 30)
            ->assertJsonPath('data.summary.ctr', 10)
            ->assertJsonCount(2, 'data.daily')
            ->assertJsonPath('data.daily.0.date', now()->toDateString());
    }

    /**
     * A boost with no metric rows still shows the post delivery the insights sheet uses.
     */
    public function test_empty_metrics_fall_back_to_the_post_delivery_shown_in_insights(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create([
            'views_count' => 139,
            'likes_count' => 2,
            'comments_count' => 1,
            'shares_count' => 1,
        ]);
        $boost = Boost::factory()->forPost($post)->active()->create();
        Sanctum::actingAs($owner);

        $this->getJson("/api/boosts/{$boost->id}/analytics")
            ->assertOk()
            ->assertJsonPath('data.summary.impressions', 139)
            ->assertJsonPath('data.summary.clicks', 4)
            ->assertJsonCount(1, 'data.daily')
            ->assertJsonPath('data.daily.0.impressions', 139);
    }

    /**
     * Someone who does not own the boosted post cannot read its analytics.
     */
    public function test_unauthorized_user_cannot_view_boost_analytics(): void
    {
        // Database setup: a boost that belongs to $owner, plus a second account.
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->active()->create();
        $stranger = User::factory()->create();

        // Sign in as the stranger, not the owner.
        Sanctum::actingAs($stranger);

        // HTTP request and assertion: the API refuses with 403 Forbidden.
        $this->getJson("/api/boosts/{$boost->id}/analytics")
            ->assertForbidden();
    }
}
