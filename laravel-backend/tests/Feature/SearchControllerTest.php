<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_unified_search_returns_sections(): void
    {
        $response = $this->getJson('/api/search?q=test');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'q',
                'sections',
            ]);
        $this->assertEquals('test', $response->json('q'));
    }

    public function test_unified_search_validates_q_required(): void
    {
        $response = $this->getJson('/api/search');

        $response->assertStatus(422);
    }

    public function test_unified_search_users_section_returns_matching_users(): void
    {
        $user = User::factory()->create([
            'handle' => '@testuser',
            'display_name' => 'Test User',
        ]);

        $response = $this->getJson('/api/search?q=test&types=users');

        $response->assertStatus(200)
            ->assertJsonPath('sections.users.items.0.id', $user->id);
    }

    public function test_unified_search_posts_section_returns_matching_posts(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'Unique searchable content here',
            'location_label' => 'Dublin',
        ]);

        $response = $this->getJson('/api/search?q=Unique&types=posts');

        $response->assertStatus(200);
        $posts = $response->json('sections.posts.items');
        $this->assertNotEmpty($posts);
        $ids = collect($posts)->pluck('id')->toArray();
        $this->assertContains($post->id, $ids);
    }
}
