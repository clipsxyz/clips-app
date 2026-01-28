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

