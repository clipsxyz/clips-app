<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\ProfileVisitEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProfileVisitAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_visiting_another_profile_without_a_boost_counts_as_a_profile_visit(): void
    {
        $debs = User::factory()->create(['handle' => 'Debs@manchester', 'is_private' => false]);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $post = Post::factory()->create([
            'user_id' => $debs->id,
            'user_handle' => $debs->handle,
        ]);

        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?tab=all&postsLimit=20')
            ->assertOk();

        $this->assertDatabaseHas('profile_visit_events', [
            'profile_user_id' => $debs->id,
            'actor_user_id' => $gazetteer->id,
            'attribution_context' => 'organic',
        ]);

        $this->actingAs($debs, 'sanctum')
            ->getJson('/api/boost/analytics/' . $post->id . '?range=all')
            ->assertOk()
            ->assertJsonPath('analytics.profileVisits', 1);
    }

    public function test_own_profile_open_does_not_count_as_a_visit(): void
    {
        $debs = User::factory()->create(['is_private' => false]);
        Post::factory()->create([
            'user_id' => $debs->id,
            'user_handle' => $debs->handle,
        ]);

        $this->actingAs($debs, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?tab=all&postsLimit=20')
            ->assertOk();

        $this->assertSame(0, ProfileVisitEvent::query()->count());
    }

    public function test_profile_post_pagination_does_not_record_another_visit(): void
    {
        $debs = User::factory()->create(['is_private' => false]);
        $gazetteer = User::factory()->create();
        Post::factory()->create([
            'user_id' => $debs->id,
            'user_handle' => $debs->handle,
        ]);

        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?tab=all&postsLimit=20')
            ->assertOk();
        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?tab=all&postsLimit=20&postsCursor=1')
            ->assertOk();

        $this->assertSame(1, ProfileVisitEvent::query()->count());
    }

    public function test_same_visitor_is_counted_once_per_day(): void
    {
        $debs = User::factory()->create(['is_private' => false]);
        $gazetteer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $debs->id,
            'user_handle' => $debs->handle,
        ]);

        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle))
            ->assertOk();
        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle))
            ->assertOk();

        $this->assertSame(1, ProfileVisitEvent::query()->count());

        $this->actingAs($debs, 'sanctum')
            ->getJson('/api/boost/analytics/' . $post->id . '?range=all')
            ->assertOk()
            ->assertJsonPath('analytics.profileVisits', 1);
    }

    public function test_active_boost_still_records_a_campaign_event(): void
    {
        $debs = User::factory()->create(['is_private' => false]);
        $gazetteer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $debs->id,
            'user_handle' => $debs->handle,
        ]);
        Boost::create([
            'post_id' => $post->id,
            'user_id' => $debs->id,
            'feed_type' => 'local',
            'price' => 1.5,
            'activated_at' => now()->subHour(),
            'expires_at' => now()->addHours(5),
        ]);

        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?sourcePostId=' . $post->id)
            ->assertOk();

        $this->assertDatabaseHas('profile_visit_events', [
            'profile_user_id' => $debs->id,
            'actor_user_id' => $gazetteer->id,
            'source_post_id' => $post->id,
            'attribution_context' => 'source_post',
        ]);
        $this->assertDatabaseHas('boost_analytics_events', [
            'post_id' => $post->id,
            'event_type' => 'profile_visit',
            'actor_user_id' => $gazetteer->id,
        ]);

        $this->actingAs($debs, 'sanctum')
            ->getJson('/api/boost/analytics/' . $post->id . '?range=all')
            ->assertOk()
            ->assertJsonPath('analytics.profileVisits', 1);
    }

    public function test_profile_payload_survives_a_missing_visit_table(): void
    {
        Schema::dropIfExists('profile_visit_events');

        $debs = User::factory()->create(['handle' => 'Debs@Manchester', 'is_private' => false]);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($debs->handle) . '?tab=all&postsLimit=20')
            ->assertOk()
            ->assertJsonFragment(['handle' => $debs->handle]);
    }
}
