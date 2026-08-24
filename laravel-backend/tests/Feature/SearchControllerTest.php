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

    public function test_unified_search_users_matches_at_prefix_username_and_place(): void
    {
        $donny = User::factory()->create([
            'handle' => 'Donny@NewYorkState',
            'display_name' => 'Donny',
            'username' => 'visual_ib',
            'location_local' => 'New York State',
            'location_regional' => 'New York State',
            'location_national' => 'USA',
        ]);
        User::factory()->create([
            'handle' => 'Gazetteer@Dublin',
            'display_name' => 'Gazetteer',
            'username' => 'clipscursar',
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);

        foreach (['Donny', '@Donny', 'visual_ib', 'New York State', 'NewYork'] as $q) {
            $response = $this->getJson('/api/search?q='.rawurlencode($q).'&types=users');
            $response->assertStatus(200);
            $ids = collect($response->json('sections.users.items'))->pluck('id')->all();
            $this->assertContains($donny->id, $ids, "query [{$q}] should find Donny@NewYorkState");
        }

        $dublinOnly = $this->getJson('/api/search?q=Dublin&types=users');
        $dublinIds = collect($dublinOnly->json('sections.users.items'))->pluck('id')->all();
        $this->assertNotContains($donny->id, $dublinIds);
    }
}
