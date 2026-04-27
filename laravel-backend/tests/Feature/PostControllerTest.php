<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

class PostControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_can_create_post_with_edit_timeline(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Test post with video editing',
                'location' => 'Dublin',
                'mediaUrl' => 'https://example.com/video.mp4',
                'mediaType' => 'video',
                'editTimeline' => [
                    'clips' => [
                        [
                            'id' => 'clip-1',
                            'mediaUrl' => 'https://example.com/video.mp4',
                            'type' => 'video',
                            'startTime' => 0,
                            'duration' => 10,
                            'trimStart' => 0,
                            'trimEnd' => 10,
                            'speed' => 1.0,
                            'reverse' => false,
                        ]
                    ],
                    'transitions' => [],
                    'totalDuration' => 10,
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'user_handle',
                'text_content',
                'render_job_id',
            ]);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'text_content' => 'Test post with video editing',
        ]);

        // Check that render job was created
        $post = Post::where('user_id', $user->id)->first();
        $this->assertNotNull($post->render_job_id);
    }

    public function test_can_create_post_without_edit_timeline(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Simple text post',
                'location' => 'Dublin',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'user_handle',
                'text_content',
            ]);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'text_content' => 'Simple text post',
        ]);
    }

    public function test_can_get_posts_with_pagination(): void
    {
        $user = User::factory()->create();
        Post::factory()->count(15)->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'location_label' => 'Dublin',
        ]);

        $response = $this->getJson('/api/posts?cursor=0&limit=10');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'items',
                'nextCursor',
                'hasMore',
            ]);

        $this->assertCount(10, $response->json('items'));
    }

    public function test_can_get_single_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $response = $this->getJson("/api/posts/{$post->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'user_handle',
                'text_content',
            ]);

        $this->assertEquals($post->id, $response->json('id'));
    }

    public function test_can_get_public_post_preview_by_token(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'public_share_token' => 'public-token-1234567890',
        ]);

        $response = $this->getJson("/api/public/posts/{$post->public_share_token}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'public_share_token',
                'user_handle',
                'text_content',
                'media_url',
                'likes_count',
                'comments_count',
                'shares_count',
                'views_count',
                'created_at',
            ]);

        $this->assertEquals($post->id, $response->json('id'));
        $this->assertEquals($post->public_share_token, $response->json('public_share_token'));
    }

    public function test_returns_404_for_invalid_public_post_token(): void
    {
        $response = $this->getJson('/api/public/posts/invalid-token-not-found');
        $response->assertStatus(404);
    }

    public function test_share_assigns_public_token_and_returns_public_url(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'public_share_token' => null,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/posts/{$post->id}/share");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'public_share_token',
                'public_share_url',
                'shares_count',
                'success',
            ]);

        $post->refresh();
        $this->assertNotNull($post->public_share_token);
        $this->assertSame($post->public_share_token, $response->json('public_share_token'));
    }

    public function test_owner_can_regenerate_share_token(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'public_share_token' => 'oldtoken1234567890',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/posts/{$post->id}/share-token/regenerate");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'public_share_token',
                'public_share_url',
            ]);

        $post->refresh();
        $this->assertNotSame('oldtoken1234567890', $post->public_share_token);
    }

    public function test_returns_404_for_nonexistent_post(): void
    {
        $response = $this->getJson('/api/posts/' . (string) \Illuminate\Support\Str::uuid());

        $response->assertStatus(400);
    }

    public function test_validates_required_fields_when_creating_post(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', []);

        $response->assertStatus(400);
        $this->assertTrue(
            $response->json('error') !== null || $response->json('errors') !== null,
            'Response should contain error or errors'
        );
    }
}

