<?php

namespace Tests\Unit\Models;

use App\Models\Collection;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_scope_returns_only_public_collections(): void
    {
        $user = User::factory()->create();
        $public = Collection::create([
            'user_id' => $user->id,
            'name' => 'Public',
            'is_private' => false,
        ]);
        Collection::create([
            'user_id' => $user->id,
            'name' => 'Private',
            'is_private' => true,
        ]);

        $results = Collection::public()->pluck('id')->all();

        $this->assertContains($public->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_private_scope_returns_only_private_collections(): void
    {
        $user = User::factory()->create();
        Collection::create([
            'user_id' => $user->id,
            'name' => 'Public',
            'is_private' => false,
        ]);
        $private = Collection::create([
            'user_id' => $user->id,
            'name' => 'Private',
            'is_private' => true,
        ]);

        $results = Collection::private()->pluck('id')->all();

        $this->assertContains($private->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_for_user_scope_filters_by_user_id(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $c1 = Collection::create([
            'user_id' => $user1->id,
            'name' => 'User1 Collection',
            'is_private' => true,
        ]);
        Collection::create([
            'user_id' => $user2->id,
            'name' => 'User2 Collection',
            'is_private' => true,
        ]);

        $results = Collection::forUser($user1->id)->pluck('id')->all();

        $this->assertContains($c1->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_contains_post_returns_true_when_post_in_collection(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $collection = Collection::create([
            'user_id' => $user->id,
            'name' => 'Test',
            'is_private' => true,
        ]);
        $collection->posts()->attach($post->id);

        $this->assertTrue($collection->fresh()->containsPost($post));
    }

    public function test_contains_post_returns_false_when_post_not_in_collection(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);
        $collection = Collection::create([
            'user_id' => $user->id,
            'name' => 'Test',
            'is_private' => true,
        ]);

        $this->assertFalse($collection->containsPost($post));
    }
}
