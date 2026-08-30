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

    public function test_me_collections_alias_requires_auth(): void
    {
        $this->getJson('/api/me/collections')->assertStatus(401);
    }

    public function test_me_collections_alias_lists_authenticated_user_collections(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/me/collections');

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

    public function test_saving_a_post_increments_unique_saves_count(): void
    {
        $author = \App\Models\User::factory()->create();
        $viewer = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'location_label' => 'Dublin',
            'saves_count' => 0,
        ]);

        $created = $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'All Posts',
                'is_private' => true,
                'post_id' => $post->id,
            ])
            ->assertStatus(201);

        $this->assertSame(1, (int) $created->json('saves_count'));
        $this->assertDatabaseHas('post_bookmarks', [
            'user_id' => $viewer->id,
            'post_id' => $post->id,
        ]);
        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'saves_count' => 1,
        ]);

        $other = User::factory()->create();
        $this->actingAs($other, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'All Posts',
                'post_id' => $post->id,
            ])
            ->assertStatus(201)
            ->assertJsonPath('saves_count', 2);

        $collectionId = $created->json('id');
        $removed = $this->actingAs($viewer, 'sanctum')
            ->deleteJson("/api/collections/{$collectionId}/posts", [
                'post_id' => $post->id,
            ])
            ->assertOk();
        $this->assertSame(1, (int) $removed->json('saves_count'));
        $this->assertFalse((bool) $removed->json('is_bookmarked'));

        $feed = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Dublin&limit=20')
            ->assertOk();
        $row = collect($feed->json('items'))->firstWhere('id', $post->id);
        $this->assertNotNull($row);
        $this->assertSame(1, (int) $row['saves_count']);
        $this->assertFalse((bool) $row['is_bookmarked']);
    }

    public function test_can_view_collection_with_saved_post(): void
    {
        $author = \App\Models\User::factory()->create();
        $viewer = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/saved.jpg',
            'media_type' => 'image',
        ]);

        $created = $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'Trip',
                'is_private' => true,
                'post_id' => $post->id,
            ])
            ->assertStatus(201);

        $collectionId = $created->json('id');

        $shown = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/collections/{$collectionId}")
            ->assertOk()
            ->assertJsonPath('name', 'Trip');

        $this->assertContains($post->id, $shown->json('postIds'));
        $this->assertSame($post->id, $shown->json('posts.0.id'));

        $listed = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/collections/{$collectionId}/posts")
            ->assertOk();
        $this->assertSame($post->id, $listed->json('0.id'));
    }

    public function test_collection_list_cover_prefers_post_still_over_video(): void
    {
        $author = \App\Models\User::factory()->create();
        $viewer = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => 'https://example.com/poster.jpg',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'All Posts',
                'is_private' => true,
                'post_id' => $post->id,
            ])
            ->assertStatus(201)
            ->assertJsonPath('thumbnailUrl', 'https://example.com/poster.jpg');

        $listed = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/collections')
            ->assertOk();

        $this->assertSame('https://example.com/poster.jpg', $listed->json('0.thumbnailUrl'));
        $this->assertContains($post->id, $listed->json('0.postIds'));
    }

    public function test_collection_list_cover_falls_back_to_video_when_no_still(): void
    {
        $author = \App\Models\User::factory()->create();
        $viewer = User::factory()->create();
        $post = \App\Models\Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => null,
            'media_items' => null,
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/collections', [
                'name' => 'Saved',
                'post_id' => $post->id,
            ])
            ->assertStatus(201);

        $listed = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/collections')
            ->assertOk();

        $this->assertSame('https://example.com/clip.mp4', $listed->json('0.thumbnailUrl'));
    }
}
