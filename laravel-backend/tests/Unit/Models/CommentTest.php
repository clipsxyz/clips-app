<?php

namespace Tests\Unit\Models;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CommentTest extends TestCase
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

    public function test_top_level_scope_returns_only_comments_without_parent(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $topLevel = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Top level',
            'parent_id' => null,
        ]);
        $reply = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Reply',
            'parent_id' => $topLevel->id,
        ]);

        $results = Comment::topLevel()->pluck('id')->all();

        $this->assertContains($topLevel->id, $results);
        $this->assertNotContains($reply->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_is_reply_returns_true_when_parent_id_set(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $parent = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Parent',
            'parent_id' => null,
        ]);
        $reply = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Reply',
            'parent_id' => $parent->id,
        ]);

        $this->assertFalse($parent->isReply());
        $this->assertTrue($reply->isReply());
    }

    public function test_is_top_level_returns_true_when_no_parent(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Top level',
            'parent_id' => null,
        ]);

        $this->assertTrue($comment->isTopLevel());
    }

    public function test_is_liked_by_returns_true_when_like_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'A comment',
            'parent_id' => null,
        ]);
        $comment->likes()->attach($user->id);

        $this->assertTrue($comment->fresh()->isLikedBy($user));
    }

    public function test_is_liked_by_returns_false_when_no_like(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'A comment',
            'parent_id' => null,
        ]);

        $this->assertFalse($comment->isLikedBy($user));
    }
}
