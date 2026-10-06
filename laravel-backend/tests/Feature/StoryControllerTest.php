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
        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'media_type' => 'video',
            'video_poster_url' => 'file:///data/user/0/com.clipsapp/cache/poster.jpg',
        ]);
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
}

