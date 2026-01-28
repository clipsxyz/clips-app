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
            ]);

        $this->assertDatabaseHas('comments', [
            'post_id' => $post->id,
            'user_id' => $user->id,
            'text_content' => 'First comment',
        ]);
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
}
