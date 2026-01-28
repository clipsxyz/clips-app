<?php

namespace Tests\Unit\Models;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::disableForeignKeyConstraints();
    }

    protected function tearDown(): void
    {
        Schema::enableForeignKeyConstraints();
        parent::tearDown();
    }

    public function test_can_view_profile_own_profile_returns_true(): void
    {
        $user = User::factory()->create();
        $this->assertTrue($user->canViewProfile($user));
    }

    public function test_can_view_profile_public_profile_returns_true(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        $viewer = User::factory()->create();
        $this->assertTrue($user->canViewProfile($viewer));
    }

    public function test_can_view_profile_private_profile_without_follow_returns_false(): void
    {
        $user = User::factory()->create(['is_private' => true]);
        $viewer = User::factory()->create();
        $this->assertFalse($user->canViewProfile($viewer));
    }

    public function test_can_view_profile_private_profile_with_follower_returns_true(): void
    {
        $user = User::factory()->create(['is_private' => true]);
        $viewer = User::factory()->create();

        DB::table('user_follows')->insert([
            'follower_id' => $viewer->id,
            'following_id' => $user->id,
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($user->canViewProfile($viewer));
    }

    public function test_can_send_message_own_returns_true(): void
    {
        $user = User::factory()->create();
        $this->assertTrue($user->canSendMessage($user));
    }

    public function test_can_send_message_public_profile_returns_true(): void
    {
        $user = User::factory()->create(['is_private' => false]);
        $sender = User::factory()->create();
        $this->assertTrue($user->canSendMessage($sender));
    }

    public function test_can_send_message_private_profile_with_follower_returns_true(): void
    {
        $user = User::factory()->create(['is_private' => true]);
        $sender = User::factory()->create();

        DB::table('user_follows')->insert([
            'follower_id' => $sender->id,
            'following_id' => $user->id,
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($user->canSendMessage($sender));
    }

    public function test_is_following_returns_true_when_relationship_accepted(): void
    {
        $follower = User::factory()->create();
        $following = User::factory()->create();

        DB::table('user_follows')->insert([
            'follower_id' => $follower->id,
            'following_id' => $following->id,
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($follower->isFollowing($following));
    }

    public function test_is_following_returns_false_when_no_relationship(): void
    {
        $follower = User::factory()->create();
        $following = User::factory()->create();

        $this->assertFalse($follower->isFollowing($following));
    }

    public function test_has_pending_follow_request_returns_true_when_pending_row_exists(): void
    {
        $follower = User::factory()->create();
        $following = User::factory()->create();

        DB::table('user_follows')->insert([
            'follower_id' => $follower->id,
            'following_id' => $following->id,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($follower->hasPendingFollowRequest($following));
    }

    public function test_has_pending_follow_request_returns_false_when_none(): void
    {
        $follower = User::factory()->create();
        $following = User::factory()->create();

        $this->assertFalse($follower->hasPendingFollowRequest($following));
    }

    public function test_has_liked_post_returns_true_when_like_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $user->postLikes()->attach($post->id);
        $this->assertTrue($user->hasLikedPost($post->fresh()));
    }

    public function test_has_liked_post_returns_false_when_no_like(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $this->assertFalse($user->hasLikedPost($post));
    }

    public function test_has_bookmarked_returns_true_when_bookmark_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $user->bookmarks()->attach($post->id);
        $this->assertTrue($user->hasBookmarked($post->fresh()));
    }

    public function test_has_reclipped_returns_true_when_reclip_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $user->reclips()->attach($post->id, ['user_handle' => $user->handle]);
        $this->assertTrue($user->hasReclipped($post->fresh()));
    }
}
