<?php

namespace Tests\Feature;

use App\Models\Draft;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DraftControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_own_drafts_empty(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/drafts')
            ->assertOk()
            ->assertExactJson([]);
    }

    public function test_can_create_and_list_draft(): void
    {
        $user = User::factory()->create();

        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/drafts', [
                'title' => 'Evening clip',
                'media_url' => 'https://example.com/clip.mp4',
                'metadata' => [
                    'caption' => 'Evening clip',
                    'mediaType' => 'video',
                    'videoDuration' => 12,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Evening clip')
            ->assertJsonPath('mediaUrl', 'https://example.com/clip.mp4')
            ->assertJsonPath('metadata.mediaType', 'video');

        $id = $created->json('id');
        $this->assertNotEmpty($id);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/drafts')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $id);
    }

    public function test_post_with_id_updates_existing_draft(): void
    {
        $user = User::factory()->create();
        $draft = Draft::create([
            'user_id' => $user->id,
            'title' => 'Old title',
            'media_url' => 'https://example.com/a.mp4',
            'metadata' => ['caption' => 'Old title'],
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/drafts', [
                'id' => $draft->id,
                'title' => 'New title',
                'media_url' => 'https://example.com/b.mp4',
                'metadata' => ['caption' => 'New title', 'mediaType' => 'image'],
            ])
            ->assertOk()
            ->assertJsonPath('id', $draft->id)
            ->assertJsonPath('title', 'New title')
            ->assertJsonPath('mediaUrl', 'https://example.com/b.mp4');

        $this->assertDatabaseHas('drafts', [
            'id' => $draft->id,
            'title' => 'New title',
        ]);
        $this->assertSame(1, Draft::query()->where('user_id', $user->id)->count());
    }

    public function test_cannot_update_or_list_another_users_draft(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $draft = Draft::create([
            'user_id' => $owner->id,
            'title' => 'Secret',
            'media_url' => null,
            'metadata' => [],
        ]);

        $this->actingAs($intruder, 'sanctum')
            ->getJson('/api/drafts')
            ->assertOk()
            ->assertExactJson([]);

        $this->actingAs($intruder, 'sanctum')
            ->postJson('/api/drafts', [
                'id' => $draft->id,
                'title' => 'Hijacked',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('drafts', [
            'id' => $draft->id,
            'user_id' => $owner->id,
            'title' => 'Secret',
        ]);
    }

    public function test_can_delete_own_draft(): void
    {
        $user = User::factory()->create();
        $draft = Draft::create([
            'user_id' => $user->id,
            'title' => 'Gone',
            'metadata' => [],
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/drafts/'.$draft->id)
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertDatabaseMissing('drafts', ['id' => $draft->id]);
    }

    public function test_cannot_delete_another_users_draft(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $draft = Draft::create([
            'user_id' => $owner->id,
            'title' => 'Keep',
            'metadata' => [],
        ]);

        $this->actingAs($intruder, 'sanctum')
            ->deleteJson('/api/drafts/'.$draft->id)
            ->assertNotFound();

        $this->assertDatabaseHas('drafts', ['id' => $draft->id]);
    }

    public function test_drafts_require_auth(): void
    {
        $this->getJson('/api/drafts')->assertUnauthorized();
        $this->postJson('/api/drafts', ['title' => 'x'])->assertUnauthorized();
    }
}
