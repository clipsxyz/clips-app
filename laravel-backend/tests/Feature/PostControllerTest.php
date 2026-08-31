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

    public function test_create_video_post_persists_thumbnail_url_from_poster(): void
    {
        $user = User::factory()->create();
        $poster = 'https://example.com/poster.jpg';

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Video clip',
                'location' => 'Dublin',
                'mediaUrl' => 'https://example.com/clip.mp4',
                'mediaType' => 'video',
                'videoPosterUrl' => $poster,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('thumbnail_url', $poster);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'thumbnail_url' => $poster,
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

    public function test_can_list_post_likes(): void
    {
        $author = User::factory()->create();
        $liker1 = User::factory()->create(['handle' => 'Liker1@Dublin']);
        $liker2 = User::factory()->create(['handle' => 'Liker2@Dublin']);
        $viewer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'likes_count' => 2,
            'views_count' => 5,
        ]);

        $liker1->postLikes()->attach($post->id);
        $liker2->postLikes()->attach($post->id);
        $liker1->followers()->attach($viewer->id, ['status' => 'accepted']);

        $response = $this->getJson("/api/posts/{$post->id}/likes?userId={$viewer->id}&limit=10");

        $response->assertStatus(200)
            ->assertJsonPath('likes_count', 2)
            ->assertJsonPath('views_count', 5)
            ->assertJsonCount(2, 'items');

        $items = collect($response->json('items'));
        $first = $items->firstWhere('handle', 'Liker1@Dublin');
        $this->assertNotNull($first);
        $this->assertTrue($first['is_following']);
    }

    public function test_toggle_like_returns_likes_count(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'likes_count' => 0,
        ]);

        $liked = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like");
        $liked->assertStatus(200)
            ->assertJsonPath('liked', true)
            ->assertJsonPath('user_liked', true)
            ->assertJsonPath('likes_count', 1);

        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'likes_count' => 1,
        ]);

        $unliked = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like");
        $unliked->assertStatus(200)
            ->assertJsonPath('liked', false)
            ->assertJsonPath('likes_count', 0);
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

    public function test_following_feed_is_empty_when_viewer_follows_nobody(): void
    {
        $viewer = User::factory()->create();
        $author = User::factory()->create(['handle' => 'Paris@CountyCork']);
        Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Following&limit=10');

        $response->assertStatus(200)
            ->assertJsonPath('followingCount', 0)
            ->assertJsonCount(0, 'items');
    }

    public function test_following_feed_shows_only_followed_authors_after_follow(): void
    {
        $viewer = User::factory()->create();
        $followed = User::factory()->create(['handle' => 'Paris@CountyCork', 'is_private' => false]);
        $stranger = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $followedPost = Post::factory()->create([
            'user_id' => $followed->id,
            'user_handle' => $followed->handle,
            'text_content' => 'from paris',
        ]);
        Post::factory()->create([
            'user_id' => $stranger->id,
            'user_handle' => $stranger->handle,
            'text_content' => 'from gazetteer',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($followed->handle) . '/follow', [
                'following' => true,
            ])
            ->assertOk()
            ->assertJsonPath('following', true);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Following&limit=10');

        $response->assertStatus(200)
            ->assertJsonPath('followingCount', 1)
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $followedPost->id);
    }

    public function test_discover_filter_is_following_feed_not_a_location(): void
    {
        $viewer = User::factory()->create();
        $followed = User::factory()->create(['is_private' => false]);
        $post = Post::factory()->create([
            'user_id' => $followed->id,
            'user_handle' => $followed->handle,
            'location_label' => 'Cork',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($followed->handle) . '/follow', [
                'following' => true,
            ])
            ->assertOk();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=discover&limit=10');

        $response->assertStatus(200)
            ->assertJsonPath('followingCount', 1)
            ->assertJsonPath('items.0.id', $post->id);
    }

    public function test_guest_following_feed_is_empty(): void
    {
        $author = User::factory()->create();
        Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $response = $this->getJson('/api/posts?filter=Following&limit=10');

        $response->assertStatus(200)
            ->assertJsonPath('followingCount', 0)
            ->assertJsonCount(0, 'items');
    }

    public function test_can_reclip_another_users_post(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'Reclip me',
            'reclips_count' => 0,
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip");

        $response->assertStatus(201)
            ->assertJsonPath('original_post.id', $post->id)
            ->assertJsonPath('original_post.user_reclipped', true)
            ->assertJsonPath('original_post.reclips_count', 1)
            ->assertJsonPath('is_reclipped', true)
            ->assertJsonPath('user_handle', $viewer->handle)
            ->assertJsonPath('original_post_id', $post->id);

        $this->assertDatabaseHas('post_reclips', [
            'user_id' => $viewer->id,
            'post_id' => $post->id,
        ]);
        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'reclips_count' => 1,
        ]);
        $this->assertTrue($viewer->fresh()->hasReclipped($post));
    }

    public function test_cannot_reclip_own_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip");

        $response->assertStatus(400)
            ->assertJsonPath('error', 'Cannot reclip your own post');
        $this->assertDatabaseMissing('post_reclips', [
            'user_id' => $user->id,
            'post_id' => $post->id,
        ]);
    }

    public function test_reclip_is_idempotent(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'reclips_count' => 0,
        ]);

        $this->actingAs($viewer, 'sanctum')->postJson("/api/posts/{$post->id}/reclip")
            ->assertStatus(201);
        $again = $this->actingAs($viewer, 'sanctum')->postJson("/api/posts/{$post->id}/reclip");

        $again->assertOk()
            ->assertJsonPath('id', $post->id)
            ->assertJsonPath('user_reclipped', true)
            ->assertJsonPath('reclips_count', 1);
        $this->assertEquals(1, Post::query()->where('original_post_id', $post->id)->count());
    }

    public function test_reclip_survives_feed_reload(): void
    {
        $author = User::factory()->create([
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $viewer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'location_label' => 'Dublin',
            'text_content' => 'Stay reclipped',
            'reclips_count' => 0,
            'is_reclipped' => false,
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip")
            ->assertStatus(201);

        $feed = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Dublin&limit=20');

        $feed->assertOk();
        $row = collect($feed->json('items'))->firstWhere('id', $post->id);
        $this->assertNotNull($row, 'Original post missing from feed after reclip');
        $this->assertTrue((bool) $row['user_reclipped']);
        $this->assertSame(1, (int) $row['reclips_count']);
    }

    public function test_feed_alias_matches_posts_index(): void
    {
        $user = User::factory()->create();
        Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'location_label' => 'Dublin',
        ]);

        $posts = $this->getJson('/api/posts?filter=Dublin&limit=10');
        $feed = $this->getJson('/api/feed?filter=Dublin&limit=10');

        $posts->assertOk();
        $feed->assertOk();
        $this->assertSame($posts->json('items.0.id'), $feed->json('items.0.id'));
        $this->assertArrayHasKey('nextCursor', $feed->json());
        $this->assertArrayHasKey('hasMore', $feed->json());
    }

    public function test_feed_paginates_with_encoded_cursor(): void
    {
        $user = User::factory()->create();
        Post::factory()->count(3)->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'location_label' => 'Dublin',
        ]);

        $first = $this->getJson('/api/posts?filter=Dublin&limit=2');
        $first->assertOk();
        $this->assertCount(2, $first->json('items'));
        $this->assertTrue($first->json('hasMore'));
        $cursor = $first->json('nextCursor');
        $this->assertIsString($cursor);
        $this->assertNotSame('0', $cursor);

        $second = $this->getJson('/api/posts?filter=Dublin&limit=2&cursor=' . urlencode($cursor));
        $second->assertOk();
        $this->assertGreaterThanOrEqual(1, count($second->json('items')));
        $this->assertNotEquals($first->json('items.0.id'), $second->json('items.0.id'));
    }

    public function test_feed_filters_by_location_and_venue(): void
    {
        $dublinAuthor = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $corkAuthor = User::factory()->create([
            'location_local' => 'Cork city',
            'location_regional' => 'Cork',
            'location_national' => 'Ireland',
        ]);
        $dublinPost = Post::factory()->create([
            'user_id' => $dublinAuthor->id,
            'user_handle' => $dublinAuthor->handle,
            'location_label' => 'Dublin',
            'venue' => null,
        ]);
        $corkPost = Post::factory()->create([
            'user_id' => $corkAuthor->id,
            'user_handle' => $corkAuthor->handle,
            'location_label' => 'Cork',
            'venue' => 'English Market',
        ]);

        $dublinFeed = $this->getJson('/api/posts?filter=Dublin&limit=20');
        $dublinFeed->assertOk();
        $dublinIds = collect($dublinFeed->json('items'))->pluck('id')->all();
        $this->assertContains($dublinPost->id, $dublinIds);
        $this->assertNotContains($corkPost->id, $dublinIds);

        $venueFeed = $this->getJson('/api/posts?filter=' . urlencode('venue:English Market') . '&limit=20');
        $venueFeed->assertOk();
        $venueIds = collect($venueFeed->json('items'))->pluck('id')->all();
        $this->assertContains($corkPost->id, $venueIds);
        $this->assertNotContains($dublinPost->id, $venueIds);
    }

    public function test_create_rejects_local_device_media_url(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Imported clip',
                'location' => 'Dublin',
                'mediaUrl' => 'file:///data/user/0/clip.mp4',
                'mediaType' => 'video',
            ])
            ->assertStatus(400)
            ->assertJsonPath('error', 'Invalid media URL');
    }

    public function test_create_stores_media_location_tags_and_imported_clip_format(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'CapCut edit from gallery',
                'location' => 'Temple Bar',
                'placeId' => 'ChIJtestdublinplace',
                'latitude' => 53.3456,
                'longitude' => -6.2675,
                'venue' => 'The Temple Bar Pub',
                'landmark' => 'Ha\'penny Bridge',
                'mediaUrl' => 'https://cdn.example.com/imports/capcut.mp4',
                'mediaType' => 'video',
                'videoPosterUrl' => 'https://cdn.example.com/imports/capcut.jpg',
                'socialFormat' => 'instagram_reels',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('location_label', 'Temple Bar')
            ->assertJsonPath('place_id', 'ChIJtestdublinplace')
            ->assertJsonPath('venue', 'The Temple Bar Pub')
            ->assertJsonPath('landmark', 'Ha\'penny Bridge')
            ->assertJsonPath('social_format', 'instagram_reels')
            ->assertJsonPath('media_url', 'https://cdn.example.com/imports/capcut.mp4');

        $this->assertEqualsWithDelta(53.3456, (float) $response->json('latitude'), 0.0001);
        $this->assertEqualsWithDelta(-6.2675, (float) $response->json('longitude'), 0.0001);
    }

    public function test_suggested_by_places_uses_preferred_travel_list(): void
    {
        $viewer = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
            'places_traveled' => ['Galway'],
            'bio' => null,
        ]);
        $author = User::factory()->create([
            'location_local' => 'Salthill',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'location_label' => 'Galway',
            'venue' => 'Latin Quarter',
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts/suggested-by-places?limit=12');

        $response->assertOk();
        $ids = collect($response->json('suggestions'))->pluck('post.id')->all();
        $this->assertContains($post->id, $ids);
    }
}

