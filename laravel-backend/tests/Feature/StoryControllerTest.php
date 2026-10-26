<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Story;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

class StoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_text_only_story(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Hello story',
                'text_color' => '#ffffff',
                'text_size' => 'medium',
            ]);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'user_id' => $user->id,
                'text' => 'Hello story',
            ]);

        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'text' => 'Hello story',
        ]);
    }

    public function test_can_create_shared_story_and_persists_reference_scope_and_poster(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'media_url' => 'https://example.com/shared.jpg',
                'media_type' => 'image',
                'text' => 'Shared from feed',
                'shared_from_post_id' => $post->id,
                'shared_from_user_handle' => $post->user_handle,
                'audience' => 'close_friends',
                'video_poster_url' => 'https://example.com/poster.jpg',
            ]);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'shared_from_post_id' => $post->id,
                'audience' => 'close_friends',
                'video_poster_url' => 'https://example.com/poster.jpg',
            ]);

        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'shared_from_post_id' => $post->id,
            'shared_from_user_handle' => $post->user_handle,
            'audience' => 'close_friends',
            'video_poster_url' => 'https://example.com/poster.jpg',
        ]);

        $story = Story::where('user_id', $user->id)->firstOrFail();
        $this->assertTrue($story->expires_at->isAfter(now()->addHours(23)));
        $this->assertTrue($story->expires_at->isBefore(now()->addHours(25)));
    }

    public function test_shared_story_with_unknown_post_id_still_persists(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'media_url' => 'https://example.com/shared.jpg',
                'media_type' => 'image',
                'text' => 'Shared a mock post',
                'shared_from_post_id' => 'local-post-123',
                'shared_from_user_handle' => 'Someone@Elsewhere',
            ]);

        // Must NOT 400 on a non-UUID / missing post reference (the FK cannot hold a
        // dangling id), otherwise the client silently falls back to the in-memory mock.
        $response->assertStatus(201);
        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'shared_from_post_id' => null,
            'shared_from_user_handle' => 'Someone@Elsewhere',
        ]);
    }

    public function test_shared_story_accepts_local_video_poster(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'media_url' => 'https://example.com/clip.mp4',
                'media_type' => 'video',
                'text' => 'Shared clip',
                'video_poster_url' => 'file:///data/user/0/com.clipsapp/cache/poster.jpg',
            ]);

        $response->assertStatus(201);
        // file:// stills only exist on the uploader's phone — persist/return null so
        // other devices don't get a black Stories 24 tile.
        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'media_type' => 'video',
            'video_poster_url' => null,
        ]);
        $this->assertNull($response->json('video_poster_url'));
    }

    public function test_cannot_create_empty_story(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', []);

        $response->assertStatus(400)
            ->assertJsonFragment([
                'error' => 'Story must have media, text, or stickers',
            ]);
    }

    public function test_can_view_story_and_increment_views(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();

        $story = Story::factory()->forUser($user)->create([
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/stories/{$story->id}/view");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('story_views', [
            'story_id' => $story->id,
            'user_id' => $viewer->id,
        ]);
    }

    public function test_cannot_view_expired_story(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();

        $story = Story::factory()->forUser($user)->expired()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/stories/{$story->id}/view");

        $response->assertStatus(400)
            ->assertJsonFragment([
                'error' => 'Story has expired',
            ]);
    }

    public function test_can_add_reaction_to_story(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();

        $story = Story::factory()->forUser($user)->create([
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/stories/{$story->id}/reaction", [
                'emoji' => '❤️',
            ]);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'story_id' => $story->id,
                'user_id' => $viewer->id,
            ]);
    }

    public function test_can_add_reply_to_story(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();

        $story = Story::factory()->forUser($user)->create([
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/stories/{$story->id}/reply", [
                'text' => 'Nice story!',
            ]);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'story_id' => $story->id,
                'user_id' => $viewer->id,
            ]);
    }

    public function test_feed_includes_followed_users_active_stories_newest_first(): void
    {
        $viewer = User::factory()->create();
        $author = User::factory()->create();
        $author->followers()->attach($viewer->id, ['status' => 'accepted']);

        $older = Story::factory()->forUser($author)->create(['expires_at' => now()->addDay()]);
        $newer = Story::factory()->forUser($author)->create(['expires_at' => now()->addDay()]);
        $older->forceFill(['created_at' => now()->subHours(3)])->saveQuietly();
        $newer->forceFill(['created_at' => now()->subMinutes(2)])->saveQuietly();

        $own = Story::factory()->forUser($viewer)->create(['expires_at' => now()->addDay()]);
        $own->forceFill(['created_at' => now()->subHour()])->saveQuietly();

        $response = $this->actingAs($viewer, 'sanctum')->getJson('/api/stories');
        $response->assertStatus(200);

        $groups = $response->json();
        $handles = array_column($groups, 'user_handle');

        // The followed author's group must be present and sorted newest-group-first.
        $this->assertContains($author->handle, $handles, 'Followed author should appear in the feed');
        $this->assertContains($viewer->handle, $handles, 'Viewer own stories should appear');

        $authorGroup = collect($groups)->firstWhere('user_handle', $author->handle);
        $authorIds = array_column($authorGroup['stories'], 'id');
        $this->assertSame($newer->id, $authorIds[0], 'Newest story should be first within the group');
        $this->assertContains($older->id, $authorIds);

        // Author's latest story (-2 min) is newer than the viewer's own (-1h), so the
        // followed author's group must sort first.
        $this->assertSame($author->handle, $groups[0]['user_handle']);

        $this->assertNotNull($own->id);
    }

    public function test_feed_excludes_unfollowed_and_expired_stories(): void
    {
        $viewer = User::factory()->create();
        $followed = User::factory()->create();
        $stranger = User::factory()->create();
        $followed->followers()->attach($viewer->id, ['status' => 'accepted']);

        $visible = Story::factory()->forUser($followed)->create(['expires_at' => now()->addDay()]);
        $expired = Story::factory()->forUser($followed)->expired()->create();
        $strangerStory = Story::factory()->forUser($stranger)->create(['expires_at' => now()->addDay()]);

        $response = $this->actingAs($viewer, 'sanctum')->getJson('/api/stories');
        $response->assertStatus(200)
            ->assertJsonFragment(['id' => $visible->id])
            ->assertJsonMissing(['id' => $expired->id])
            ->assertJsonMissing(['id' => $strangerStory->id]);
    }

    public function test_paged_feed_scopes_to_followed_users(): void
    {
        $viewer = User::factory()->create();
        $followed = User::factory()->create();
        $stranger = User::factory()->create();
        $followed->followers()->attach($viewer->id, ['status' => 'accepted']);

        $followedStory = Story::factory()->forUser($followed)->create(['expires_at' => now()->addDay()]);
        $strangerStory = Story::factory()->forUser($stranger)->create(['expires_at' => now()->addDay()]);

        $response = $this->actingAs($viewer, 'sanctum')->getJson('/api/stories/paged');
        $response->assertStatus(200);

        $ids = array_column($response->json('items'), 'id');
        $this->assertContains($followedStory->id, $ids);
        $this->assertNotContains($strangerStory->id, $ids);
    }

    public function test_location_filter_still_includes_followed_author_from_another_city(): void
    {
        $viewer = User::factory()->create([
            'handle' => 'Gazetteer@Dublin',
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $debs = User::factory()->create([
            'handle' => 'Debs@Manchester',
            'location_local' => 'Manchester',
            'location_regional' => 'England',
            'location_national' => 'UK',
        ]);
        $localStranger = User::factory()->create([
            'handle' => 'Local@Dublin',
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $spainStranger = User::factory()->create([
            'handle' => 'Pilar@Madrid',
            'location_local' => 'Madrid',
            'location_regional' => 'Madrid',
            'location_national' => 'Spain',
        ]);

        $debs->followers()->attach($viewer->id, ['status' => 'accepted']);

        $debsStory = Story::factory()->forUser($debs)->create(['expires_at' => now()->addDay()]);
        $localStory = Story::factory()->forUser($localStranger)->create(['expires_at' => now()->addDay()]);
        $spainStory = Story::factory()->forUser($spainStranger)->create(['expires_at' => now()->addDay()]);

        foreach (['Ireland', 'Dublin', 'Manchester'] as $filter) {
            $response = $this->actingAs($viewer, 'sanctum')
                ->getJson('/api/stories/paged?filter='.urlencode($filter));
            $response->assertStatus(200);

            $ids = array_column($response->json('items'), 'id');
            $this->assertContains(
                $debsStory->id,
                $ids,
                "Followed Manchester author must appear on the {$filter} Stories 24 rail"
            );
            $this->assertNotContains($spainStory->id, $ids);
        }

        $ireland = $this->actingAs($viewer, 'sanctum')->getJson('/api/stories/paged?filter=Ireland');
        $irelandIds = array_column($ireland->json('items'), 'id');
        $this->assertContains($localStory->id, $irelandIds, 'Unfollowed Dublin author should appear on Ireland via location OR');
    }

    public function test_pending_follow_does_not_add_story_to_rail(): void
    {
        $viewer = User::factory()->create([
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $privateAuthor = User::factory()->create([
            'is_private' => true,
            'location_local' => 'Madrid',
            'location_regional' => 'Madrid',
            'location_national' => 'Spain',
        ]);
        $privateAuthor->followers()->attach($viewer->id, ['status' => 'pending']);

        $story = Story::factory()->forUser($privateAuthor)->create(['expires_at' => now()->addDay()]);

        $response = $this->actingAs($viewer, 'sanctum')->getJson('/api/stories/paged?filter=Ireland');
        $response->assertStatus(200);
        $this->assertNotContains($story->id, array_column($response->json('items'), 'id'));
    }

    public function test_story_media_urls_rewrite_localhost_onto_the_request_host(): void
    {
        $user = User::factory()->create();
        Story::factory()->forUser($user)->create([
            'media_type' => 'video',
            'media_url' => 'http://localhost:8000/storage/uploads/clip.mp4',
            'video_poster_url' => 'http://localhost:8000/storage/uploads/clip.jpg',
            'expires_at' => now()->addDay(),
        ]);

        $handle = rawurlencode($user->handle);
        $response = $this->actingAs($user, 'sanctum')->getJson(
            "http://192.168.1.13:8000/api/stories/user/{$handle}",
        );

        $response->assertStatus(200);
        $story = $response->json('0');
        $this->assertSame('http://192.168.1.13:8000/storage/uploads/clip.mp4', $story['media_url'] ?? null);
        $this->assertSame('http://192.168.1.13:8000/storage/uploads/clip.jpg', $story['video_poster_url'] ?? null);
    }

    public function test_guest_can_view_public_shared_story(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        $story = Story::factory()->forUser($user)->create([
            'text' => 'Shared to WhatsApp',
            'audience' => 'public',
            'expires_at' => now()->addDay(),
        ]);

        $response = $this->getJson(
            '/api/public/stories?user='.rawurlencode($user->handle).'&story='.$story->id,
        );

        $response->assertStatus(200)
            ->assertJsonFragment([
                'id' => $story->id,
                'text' => 'Shared to WhatsApp',
            ]);
    }

    public function test_guest_cannot_view_close_friends_or_private_account_story(): void
    {
        $publicUser = User::factory()->create(['is_private' => false]);
        $close = Story::factory()->forUser($publicUser)->create([
            'audience' => 'close_friends',
            'expires_at' => now()->addDay(),
        ]);
        $privateUser = User::factory()->create(['is_private' => true]);
        $hidden = Story::factory()->forUser($privateUser)->create([
            'audience' => 'public',
            'expires_at' => now()->addDay(),
        ]);

        $this->getJson(
            '/api/public/stories?user='.rawurlencode($publicUser->handle).'&story='.$close->id,
        )->assertStatus(404);

        $this->getJson(
            '/api/public/stories?user='.rawurlencode($privateUser->handle).'&story='.$hidden->id,
        )->assertStatus(404);
    }
}

