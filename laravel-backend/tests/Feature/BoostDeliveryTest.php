<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Post;
use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_feed_ranks_the_boost_furthest_behind_its_paid_audience(): void
    {
        $viewer = User::factory()->create([
            'location_local' => 'Galway',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);
        $behind = $this->boostFor('Galway', 'local', now()->subHours(5), 6);
        $steady = $this->boostFor('Galway', 'local', now()->subHour(), 72);
        $this->boostFor('Dublin', 'local', now()->subHours(5), 6);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/boosts/delivery?surface=location&feedType=local');

        $response->assertOk();
        $ids = collect($response->json('candidates'))->pluck('postId')->all();
        $this->assertSame([(string) $behind->post_id, (string) $steady->post_id], $ids);
        $this->assertGreaterThan(0.5, $response->json('candidates.0.paceGap'));
    }

    public function test_a_viewer_who_already_counted_is_not_offered_the_boost_again(): void
    {
        $viewer = User::factory()->create(['location_local' => 'Galway']);
        $boost = $this->boostFor('Galway', 'local', now()->subHours(3), 6);
        BoostAnalyticsEvent::query()->create([
            'boost_id' => $boost->id,
            'post_id' => $boost->post_id,
            'actor_user_id' => $viewer->id,
            'event_type' => 'reach',
            'attribution_context' => 'feed',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/boosts/delivery?surface=location&feedType=local')
            ->assertOk()
            ->assertJsonPath('candidates', []);
    }

    public function test_the_buyer_is_not_in_their_own_paid_slot(): void
    {
        $owner = User::factory()->create(['location_local' => 'Galway']);
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);
        Boost::query()->create([
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'feed_type' => 'local',
            'price' => 1.5,
            'activated_at' => now()->subHours(3),
            'expires_at' => now()->addHours(3),
            'duration_hours' => 6,
            'eligible_users_count' => 150,
            'status' => 'active',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/boosts/delivery?surface=location&feedType=local')
            ->assertOk()
            ->assertJsonPath('candidates', []);
    }

    public function test_stories_only_include_a_live_public_story_from_the_paid_area(): void
    {
        $viewer = User::factory()->create([
            'location_national' => 'Ireland',
        ]);
        $boost = $this->boostFor('Ireland', 'national', now()->subHours(2), 6, 'location_national');
        $owner = User::query()->findOrFail($boost->user_id);
        $story = Story::factory()->forUser($owner)->create([
            'text' => 'Open today',
            'audience' => 'public',
            'expires_at' => now()->addHours(12),
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/boosts/delivery?surface=stories');

        $response->assertOk()
            ->assertJsonPath('candidates.0.postId', (string) $boost->post_id)
            ->assertJsonPath('candidates.0.story.id', (string) $story->id)
            ->assertJsonPath('candidates.0.story.handle', $owner->handle);
    }

    private function boostFor(
        string $area,
        string $feedType,
        $activatedAt,
        int $durationHours,
        string $column = 'location_local',
    ): Boost {
        $owner = User::factory()->create([$column => $area]);
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);

        return Boost::query()->create([
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'feed_type' => $feedType,
            'price' => 1.5,
            'activated_at' => $activatedAt,
            'expires_at' => $activatedAt->copy()->addHours($durationHours),
            'duration_hours' => $durationHours,
            'eligible_users_count' => 150,
            'status' => 'active',
        ]);
    }
}
