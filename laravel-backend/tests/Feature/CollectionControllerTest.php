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
}
