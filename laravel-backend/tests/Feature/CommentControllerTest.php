<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_get_post_comments_empty(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}");

        $response->assertStatus(200)
            ->assertJson([]);
    }

    public function test_can_add_comment_to_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/comments/post/{$post->id}", [
                'text' => 'First comment',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['id', 'post_id', 'user_id', 'user_handle', 'text_content'])
            ->assertJson([
                'text_content' => 'First comment',
                'user_id' => $user->id,
                'comments_count' => 1,
            ]);

        $this->assertDatabaseHas('comments', [
            'post_id' => $post->id,
            'user_id' => $user->id,
            'text_content' => 'First comment',
        ]);
        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'comments_count' => 1,
        ]);

        $list = $this->actingAs($user, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}?paged=true");
        $list->assertStatus(200)
            ->assertJsonPath('items.0.text_content', 'First comment')
            ->assertJsonPath('hasMore', false);
    }

    public function test_can_add_reply_to_comment(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $parent = Comment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Parent comment',
            'parent_id' => null,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/comments/reply/{$parent->id}", [
                'text' => 'A reply',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['id', 'post_id', 'parent_id', 'text_content'])
            ->assertJson([
                'parent_id' => $parent->id,
                'text_content' => 'A reply',
            ]);

        $this->assertDatabaseHas('comments', [
            'parent_id' => $parent->id,
            'text_content' => 'A reply',
        ]);
    }

    public function test_can_toggle_comment_like(): void
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

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/comments/{$comment->id}/like");

        $response->assertStatus(200)
            ->assertJson(['liked' => true]);

        $response2 = $this->actingAs($user, 'sanctum')
            ->postJson("/api/comments/{$comment->id}/like");

        $response2->assertStatus(200)
            ->assertJson(['liked' => false]);
    }

    public function test_add_comment_validates_text(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/comments/post/{$post->id}", []);

        $response->assertStatus(400)
            ->assertJsonStructure(['errors']);
    }

    public function test_owner_can_hide_comment_and_other_viewers_do_not_see_it(): void
    {
        $owner = User::factory()->create();
        $commenter = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);
        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $commenter->id,
            'user_handle' => $commenter->handle,
            'text_content' => 'Please hide me',
            'parent_id' => null,
        ]);

        $this->actingAs($commenter, 'sanctum')
            ->postJson("/api/comments/{$comment->id}/hide")
            ->assertStatus(403);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/comments/{$comment->id}/hide")
            ->assertOk()
            ->assertJsonPath('is_hidden', true)
            ->assertJsonPath('moderation_status', 'hidden');

        $this->actingAs($commenter, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}")
            ->assertOk()
            ->assertJson([]);

        $ownerList = $this->actingAs($owner, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}");
        $ownerList->assertOk();
        $this->assertSame('Please hide me', $ownerList->json('0.text_content'));
    }

    public function test_owner_can_approve_hidden_comment_and_it_returns_to_listing(): void
    {
        $owner = User::factory()->create();
        $commenter = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);
        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $commenter->id,
            'user_handle' => $commenter->handle,
            'text_content' => 'Held for review',
            'parent_id' => null,
            'moderation_status' => 'pending_review',
            'is_hidden' => true,
            'flagged_keywords' => ['insult'],
        ]);

        $queue = $this->actingAs($owner, 'sanctum')
            ->getJson('/api/comments/review-queue');
        $queue->assertOk()
            ->assertJsonPath('matched_count', 1)
            ->assertJsonPath('items.0.id', $comment->id);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/comments/{$comment->id}/approve")
            ->assertOk()
            ->assertJsonPath('moderation_status', 'approved')
            ->assertJsonPath('is_hidden', false);

        $this->actingAs($commenter, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}")
            ->assertOk()
            ->assertJsonPath('0.text_content', 'Held for review');

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/comments/review-queue')
            ->assertOk()
            ->assertJsonPath('matched_count', 0);
    }

    public function test_creating_comment_can_persist_pending_review(): void
    {
        $owner = User::factory()->create();
        $commenter = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);

        $this->actingAs($commenter, 'sanctum')
            ->postJson("/api/comments/post/{$post->id}", [
                'text' => 'you are an idiot',
                'moderation_status' => 'pending_review',
                'is_hidden' => true,
                'flagged_keywords' => ['insult'],
            ])
            ->assertStatus(201)
            ->assertJsonPath('moderation_status', 'pending_review')
            ->assertJsonPath('is_hidden', true);

        $this->actingAs($commenter, 'sanctum')
            ->getJson("/api/comments/post/{$post->id}")
            ->assertOk()
            ->assertJson([]);
    }
}
