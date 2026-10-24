<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollectionControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_collections_empty(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/collections');

        $response->assertStatus(200)
            ->assertJson([]);
    }

    public function test_can_create_collection(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'My Favorites',
                'is_private' => true,
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'userId',
                'name',
                'isPrivate',
                'postIds',
                'createdAt',
                'updatedAt',
            ])
            ->assertJson([
                'userId' => $user->id,
                'name' => 'My Favorites',
                'isPrivate' => true,
            ]);

        $this->assertDatabaseHas('collections', [
            'user_id' => $user->id,
            'name' => 'My Favorites',
            'is_private' => true,
        ]);
    }

    public function test_can_create_collection_with_post(): void
    {
        $user = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_url' => 'https://example.com/image.jpg',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'With Post',
                'is_private' => false,
                'post_id' => $post->id,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'name' => 'With Post',
                'isPrivate' => false,
            ]);
        $postIds = $response->json('postIds');
        $this->assertContains($post->id, $postIds);
    }

    public function test_create_collection_validates_name(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/collections', []);

        $response->assertStatus(400)
            ->assertJsonStructure(['errors']);
    }

    public function test_list_falls_back_cover_url_to_latest_post_thumbnail(): void
    {
        $user = User::factory()->create();
        $older = \App\Models\Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_type' => 'image',
            'media_url' => 'https://example.com/older.jpg',
            'thumbnail_url' => 'https://example.com/older-thumb.jpg',
        ]);
        $latest = \App\Models\Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/debs-clip.mp4',
            'thumbnail_url' => 'https://example.com/debs-cover.jpg',
        ]);
        $collection = \App\Models\Collection::create([
            'user_id' => $user->id,
            'name' => 'Debs',
            'is_private' => true,
            'thumbnail_url' => null,
        ]);
        $collection->posts()->attach($older->id, ['created_at' => now()->subHour(), 'updated_at' => now()->subHour()]);
        $collection->posts()->attach($latest->id, ['created_at' => now(), 'updated_at' => now()]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/collections');

        $response->assertStatus(200)
            ->assertJsonPath('0.name', 'Debs')
            ->assertJsonPath('0.cover_url', 'https://example.com/debs-cover.jpg')
            ->assertJsonPath('0.thumbnail_url', 'https://example.com/debs-cover.jpg')
            ->assertJsonPath('0.latest_post.thumbnail_url', 'https://example.com/debs-cover.jpg');
    }

    public function test_list_ignores_stored_video_cover_and_uses_post_poster(): void
    {
        $user = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => 'https://example.com/clip.jpg',
        ]);
        $collection = \App\Models\Collection::create([
            'user_id' => $user->id,
            'name' => 'Videos',
            'is_private' => true,
            'thumbnail_url' => 'https://example.com/clip.mp4',
        ]);
        $collection->posts()->attach($post->id);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/collections');

        $response->assertStatus(200)
            ->assertJsonPath('0.cover_url', 'https://example.com/clip.jpg')
            ->assertJsonPath('0.thumbnailUrl', 'https://example.com/clip.jpg');
    }
}
