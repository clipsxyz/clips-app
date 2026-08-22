<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_get_public_user_profile(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'location_label' => 'Dublin',
        ]);

        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . $user->handle . '?userId=' . $viewer->id);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'handle',
                'display_name',
                'posts',
            ]);
        $this->assertEquals($user->id, $response->json('id'));
    }

    public function test_user_profile_requires_auth(): void
    {
        $user = User::factory()->create(['is_private' => false]);

        $response = $this->getJson('/api/users/' . $user->handle);

        $response->assertStatus(401);
    }

    public function test_private_profile_returns_403_when_not_follower(): void
    {
        $user = User::factory()->create(['is_private' => true]);
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . $user->handle . '?userId=' . $viewer->id);

        $response->assertStatus(403)
            ->assertJsonFragment(['can_view' => false]);
    }

    public function test_returns_404_for_nonexistent_handle(): void
    {
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/@nonexistentuser12345');

        $response->assertStatus(404)
            ->assertJsonFragment(['error' => 'User not found']);
    }

    public function test_profile_returns_posts_and_accepts_user_id_or_handle_case(): void
    {
        $user = User::factory()->create([
            'is_private' => false,
            'handle' => 'Sarah@Artane',
        ]);
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'is_reclipped' => false,
        ]);
        $viewer = User::factory()->create();

        $byHandle = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode('sarah@artane') . '?tab=all&postsLimit=20');
        $byHandle->assertStatus(200);
        $this->assertCount(1, $byHandle->json('posts'));
        $this->assertSame($post->id, $byHandle->json('posts.0.id'));
        $this->assertSame(1, $byHandle->json('posts_count'));

        $byId = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . $user->id . '/posts?tab=all&postsLimit=20');
        $byId->assertStatus(200);
        $this->assertCount(1, $byId->json('posts'));
        $this->assertSame($post->id, $byId->json('posts.0.id'));
    }

    public function test_profile_sums_likes_and_views_across_all_posts(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'likes_count' => 3,
            'views_count' => 10,
            'is_reclipped' => false,
        ]);
        Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'likes_count' => 5,
            'views_count' => 20,
            'is_reclipped' => false,
        ]);
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($user->handle) . '?tab=all&postsLimit=20');

        $response->assertStatus(200)
            ->assertJsonPath('stats.likes', 8)
            ->assertJsonPath('stats.likes_count', 8)
            ->assertJsonPath('stats.views', 30)
            ->assertJsonPath('likes_count', 8)
            ->assertJsonPath('views_count', 30);

        $postsOnly = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($user->handle) . '/posts?tab=all&postsLimit=20');
        $postsOnly->assertStatus(200)
            ->assertJsonPath('stats.likes', 8)
            ->assertJsonPath('stats.likes_count', 8)
            ->assertJsonPath('stats.views', 30)
            ->assertJsonPath('likes_count', 8)
            ->assertJsonPath('views_count', 30);
    }

    public function test_profile_posts_include_thumbnail_url_for_video(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        $poster = 'https://example.com/frame.jpg';
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => $poster,
            'media_items' => [[
                'url' => 'https://example.com/clip.mp4',
                'type' => 'video',
                'posterUrl' => $poster,
            ]],
            'is_reclipped' => false,
        ]);
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($user->handle) . '?tab=all&postsLimit=20');

        $response->assertStatus(200);
        $this->assertSame($post->id, $response->json('posts.0.id'));
        $this->assertSame($poster, $response->json('posts.0.thumbnail_url'));
        $this->assertSame($poster, $response->json('posts.0.video_poster_url'));
    }

    public function test_invalid_source_post_id_does_not_fail_profile(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/' . rawurlencode($user->handle) . '?sourcePostId=not-a-uuid&tab=all');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'posts');
    }

    public function test_can_follow_and_unfollow_public_user(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => false]);

        // Follow public user
        $response = $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . $following->handle . '/follow');

        $response->assertStatus(200)
            ->assertJson([
                'following' => true,
                'status' => 'accepted',
            ]);

        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
            'status' => 'accepted',
        ]);

        $this->assertEquals(1, $follower->fresh()->following_count);
        $this->assertEquals(1, $following->fresh()->followers_count);

        // Unfollow
        $response2 = $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . $following->handle . '/follow');

        $response2->assertStatus(200)
            ->assertJson([
                'following' => false,
                'status' => 'unfollowed',
            ]);

        $this->assertDatabaseMissing('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
        ]);

        $this->assertEquals(0, $follower->fresh()->following_count);
        $this->assertEquals(0, $following->fresh()->followers_count);
    }

    public function test_follow_with_following_true_is_idempotent(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => false, 'handle' => 'Paris@CountyCork']);

        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($following->handle) . '/follow', [
                'following' => true,
            ])
            ->assertOk()
            ->assertJson(['following' => true, 'status' => 'accepted']);

        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($following->handle) . '/follow', [
                'following' => true,
            ])
            ->assertOk()
            ->assertJson(['following' => true, 'status' => 'accepted']);

        $this->assertEquals(1, DB::table('user_follows')->count());
        $this->assertEquals(1, $follower->fresh()->following_count);
        $this->assertEquals(1, $following->fresh()->followers_count);
    }

    public function test_follow_with_following_false_unfollows(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => false, 'handle' => 'Paris@CountyCork']);

        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($following->handle) . '/follow', [
                'following' => true,
            ])
            ->assertOk()
            ->assertJson(['following' => true, 'status' => 'accepted']);

        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . rawurlencode($following->handle) . '/follow', [
                'following' => false,
            ])
            ->assertOk()
            ->assertJson(['following' => false, 'status' => 'unfollowed']);

        $this->assertDatabaseMissing('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
        ]);
        $this->assertEquals(0, $follower->fresh()->following_count);
        $this->assertEquals(0, $following->fresh()->followers_count);
    }

    public function test_follow_private_user_creates_pending_request_and_notification(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => true]);

        $response = $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . $following->handle . '/follow');

        $response->assertStatus(200)
            ->assertJson([
                'following' => false,
                'status' => 'pending',
            ]);

        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $following->id,
            'type' => 'follow_request',
            'from_handle' => $follower->handle,
            'to_handle' => $following->handle,
        ]);
    }

    public function test_can_accept_follow_request_for_private_user(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => true]);

        // Follower sends follow request
        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . $following->handle . '/follow')
            ->assertStatus(200)
            ->assertJson(['status' => 'pending']);

        // Following user accepts
        $response = $this->actingAs($following, 'sanctum')
            ->postJson('/api/users/' . $follower->handle . '/follow/accept');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'accepted',
            ]);

        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
            'status' => 'accepted',
        ]);

        $this->assertEquals(1, $follower->fresh()->following_count);
        $this->assertEquals(1, $following->fresh()->followers_count);

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $following->id,
            'type' => 'follow_request',
            'from_handle' => $follower->handle,
        ]);
    }

    public function test_can_deny_follow_request_for_private_user(): void
    {
        $follower = User::factory()->create(['is_private' => false]);
        $following = User::factory()->create(['is_private' => true]);

        // Follower sends follow request
        $this->actingAs($follower, 'sanctum')
            ->postJson('/api/users/' . $following->handle . '/follow')
            ->assertStatus(200)
            ->assertJson(['status' => 'pending']);

        // Following user denies
        $response = $this->actingAs($following, 'sanctum')
            ->postJson('/api/users/' . $follower->handle . '/follow/deny');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'denied',
            ]);

        $this->assertDatabaseMissing('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $following->id,
        ]);

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $following->id,
            'type' => 'follow_request',
            'from_handle' => $follower->handle,
        ]);
    }

    public function test_toggle_privacy_flips_is_private_flag(): void
    {
        $user = User::factory()->create(['is_private' => false]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/users/privacy/toggle');

        $response->assertStatus(200)
            ->assertJson([
                'is_private' => true,
            ]);

        $this->assertTrue($user->fresh()->is_private);

        $response2 = $this->actingAs($user, 'sanctum')
            ->postJson('/api/users/privacy/toggle');

        $response2->assertStatus(200)
            ->assertJson([
                'is_private' => false,
            ]);

        $this->assertFalse($user->fresh()->is_private);
    }
}
