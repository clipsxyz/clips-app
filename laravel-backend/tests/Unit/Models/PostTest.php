<?php

namespace Tests\Unit\Models;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PostTest extends TestCase
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

    public function test_not_reclipped_scope_excludes_reclipped_posts(): void
    {
        $user = User::factory()->create();

        $originalPost = Post::factory()->create([
            'user_id' => $user->id,
            'is_reclipped' => false,
        ]);

        $reclippedPost = Post::factory()->create([
            'user_id' => $user->id,
            'is_reclipped' => true,
            'original_post_id' => $originalPost->id,
        ]);

        $results = Post::notReclipped()->pluck('id')->all();

        $this->assertContains($originalPost->id, $results);
        $this->assertNotContains($reclippedPost->id, $results);
    }

    public function test_by_location_scope_filters_by_location_label(): void
    {
        $user = User::factory()->create();

        $dublinPost = Post::factory()->create([
            'user_id' => $user->id,
            'location_label' => 'Dublin, Ireland',
        ]);

        Post::factory()->create([
            'user_id' => $user->id,
            'location_label' => 'London, UK',
        ]);

        $results = Post::byLocation('Dublin')->pluck('id')->all();

        $this->assertContains($dublinPost->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_is_liked_by_returns_true_when_like_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        // Use the relationship helper so the pivot row matches
        // the model's belongsToMany configuration.
        $user->postLikes()->attach($post->id);

        $this->assertTrue($post->fresh()->isLikedBy($user));
    }

    public function test_is_bookmarked_by_checks_post_bookmarks_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->bookmarks()->attach($post->id);

        $this->assertTrue($post->fresh()->isBookmarkedBy($user));
    }

    public function test_is_viewed_by_checks_post_views_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->views()->attach($post->id);

        $this->assertTrue($post->fresh()->isViewedBy($user));
    }

    public function test_is_reclipped_by_checks_post_reclips_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->reclips()->attach($post->id, ['user_handle' => $user->handle]);

        $this->assertTrue($post->fresh()->isReclippedBy($user));
    }

    public function test_is_following_author_uses_followers_relationship(): void
    {
        $author = User::factory()->create();
        $follower = User::factory()->create();

        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        // Attach follower using the relationship so the pivot row
        // is shaped exactly like the model expects.
        $author->followers()->attach($follower->id, ['status' => 'accepted']);

        $this->assertTrue($post->fresh()->isFollowingAuthor($follower));
    }
}

