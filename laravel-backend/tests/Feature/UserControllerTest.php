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

    public function test_returns_400_for_nonexistent_handle(): void
    {
        $viewer = User::factory()->create();

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/users/@nonexistentuser12345');

        $response->assertStatus(400)
            ->assertJsonStructure(['errors']);
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
