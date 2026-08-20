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

    public function test_can_create_story_with_unknown_tagged_handle(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Tagged someone new',
                'taggedUsers' => ['Nobody@Nowhere'],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('text', 'Tagged someone new')
            ->assertJsonPath('user_id', $user->id);

        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'text' => 'Tagged someone new',
        ]);
    }

    public function test_shared_feed_post_story_keeps_original_post_id(): void
    {
        $author = User::factory()->create(['handle' => 'Sarah@Artane']);
        $sharer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'Newsfeed clip',
        ]);

        $response = $this->actingAs($sharer, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Newsfeed clip',
                'shared_from_post_id' => $post->id,
                'shared_from_user_handle' => $author->handle,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('shared_from_post_id', $post->id)
            ->assertJsonPath('shared_from_user_handle', $author->handle);

        $this->assertDatabaseHas('stories', [
            'user_id' => $sharer->id,
            'shared_from_post_id' => $post->id,
            'shared_from_user_handle' => $author->handle,
        ]);

        $list = $this->actingAs($sharer, 'sanctum')
            ->getJson('/api/stories?userId='.$sharer->id);

        $list->assertStatus(200)
            ->assertJsonFragment([
                'shared_from_post_id' => $post->id,
            ]);
    }

    public function test_can_create_poll_story_without_media(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'poll' => [
                    'question' => 'Coffee or tea?',
                    'option1' => 'Coffee',
                    'option2' => 'Tea',
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('text', 'Coffee or tea?')
            ->assertJsonPath('user_id', $user->id);

        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'text' => 'Coffee or tea?',
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

    public function test_can_list_own_active_stories_by_handle(): void
    {
        $user = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'On my 24',
            ])
            ->assertStatus(201);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/stories/user/'.rawurlencode('Gazetteer@Dublin'));

        $response->assertStatus(200)
            ->assertJsonFragment(['text' => 'On my 24']);
        $this->assertNotEmpty($response->json());
    }

    public function test_index_returns_persisted_active_stories_within_24_hours(): void
    {
        $user = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $viewer = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Stay on the rail',
            ])
            ->assertStatus(201)
            ->assertJsonPath('text', 'Stay on the rail')
            ->assertJsonPath('user_id', $user->id);

        $this->assertDatabaseHas('stories', [
            'user_id' => $user->id,
            'text' => 'Stay on the rail',
        ]);

        Story::factory()->forUser($user)->expired()->create([
            'text' => 'Too old',
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/stories?userId='.$viewer->id);

        $response->assertStatus(200)
            ->assertJsonFragment(['text' => 'Stay on the rail']);

        $payload = $response->json();
        $this->assertIsArray($payload);
        $allTexts = collect($payload)->flatMap(fn ($group) => collect($group['stories'])->pluck('text'))->all();
        $this->assertContains('Stay on the rail', $allTexts);
        $this->assertNotContains('Too old', $allTexts);
    }
}

