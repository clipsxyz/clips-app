<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BoostPostsFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_filter_posts_by_boost_status_and_receive_counts(): void
    {
        $owner = User::factory()->create();
        $ready = Post::factory()->forUser($owner)->create();
        $activePost = Post::factory()->forUser($owner)->create();
        $endedPost = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($activePost)->active()->create();
        Boost::factory()->forPost($endedPost)->create([
            'status' => 'active',
            'activated_at' => now()->subHours(12),
            'expires_at' => now()->subHour(),
        ]);

        $stranger = User::factory()->create();
        Post::factory()->forUser($stranger)->create();

        Sanctum::actingAs($owner);

        $this->getJson('/api/boost/posts?status=all')
            ->assertOk()
            ->assertJsonPath('counts.all', 3)
            ->assertJsonPath('counts.ready', 1)
            ->assertJsonPath('counts.active', 1)
            ->assertJsonPath('counts.ended', 1)
            ->assertJsonCount(3, 'posts');

        $this->getJson('/api/boost/posts?status=active')
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('counts.ready', 1)
            ->assertJsonCount(1, 'posts')
            ->assertJsonPath('posts.0.id', $activePost->id)
            ->assertJsonPath('posts.0.boost_status', 'active')
            ->assertJsonPath('posts.0.is_boosted', true);

        $this->getJson('/api/boost/posts?status=ended')
            ->assertOk()
            ->assertJsonCount(1, 'posts')
            ->assertJsonPath('posts.0.id', $endedPost->id)
            ->assertJsonPath('posts.0.boost_status', 'ended');

        $this->getJson('/api/boost/posts?status=ready')
            ->assertOk()
            ->assertJsonCount(1, 'posts')
            ->assertJsonPath('posts.0.id', $ready->id)
            ->assertJsonPath('posts.0.boost_status', 'ready');
    }

    public function test_boost_posts_require_authentication(): void
    {
        $this->getJson('/api/boost/posts?status=active')->assertUnauthorized();
    }
}
