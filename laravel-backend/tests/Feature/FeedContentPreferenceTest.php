<?php

namespace Tests\Feature;

use App\Models\FeedContentPreference;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedContentPreferenceTest extends TestCase
{
    use RefreshDatabase;

    private function authUser(): User
    {
        return User::factory()->create(['handle' => '@alice']);
    }

    private function prefsFor(User $user): FeedContentPreference
    {
        return FeedContentPreference::query()
            ->where('user_id', $user->id)
            ->firstOrFail();
    }

    public function test_show_returns_empty_lists_by_default(): void
    {
        $user = $this->authUser();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/feed-content-preferences');

        $response->assertOk()
            ->assertExactJson([
                'muted_handles' => [],
                'blocked_handles' => [],
                'hidden_post_ids' => [],
                'not_interested_post_ids' => [],
            ]);
    }

    public function test_mute_adds_and_normalizes_handle(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/mute', ['handle' => '@BigHandle'])
            ->assertOk()
            ->assertJsonPath('muted_handles', ['bighandle']);

        $this->assertSame(['bighandle'], $this->prefsFor($user)->muted_handles);
    }

    public function test_mute_is_idempotent(): void
    {
        $user = $this->authUser();
        $this->actingAs($user, 'sanctum')->postJson('/api/feed-content-preferences/mute', ['handle' => 'bob']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/mute', ['handle' => '@Bob'])
            ->assertOk()
            ->assertJsonPath('muted_handles', ['bob']);
    }

    public function test_mute_requires_handle(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/mute', [])
            ->assertStatus(422)
            ->assertJsonPath('error', 'handle required');
    }

    public function test_block_adds_handle_and_persists(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/block', ['handle' => '@Charlie'])
            ->assertOk()
            ->assertJsonPath('blocked_handles', ['charlie']);

        $this->assertSame(['charlie'], $this->prefsFor($user)->blocked_handles);
    }

    public function test_hide_adds_post_id_without_duplicates(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/hide', ['post_id' => 'post-1'])
            ->assertOk()
            ->assertJsonPath('hidden_post_ids', ['post-1']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/hide', ['postId' => 'post-1'])
            ->assertOk()
            ->assertJsonPath('hidden_post_ids', ['post-1']);

        $this->assertSame(['post-1'], $this->prefsFor($user)->hidden_post_ids);
    }

    public function test_hide_requires_post_id(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/hide', [])
            ->assertStatus(422)
            ->assertJsonPath('error', 'post_id required');
    }

    public function test_not_interested_adds_and_dedupes(): void
    {
        $user = $this->authUser();
        $this->actingAs($user, 'sanctum')->postJson('/api/feed-content-preferences/not-interested', ['post_id' => 'post-7']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/feed-content-preferences/not-interested', ['post_id' => 'post-7'])
            ->assertOk()
            ->assertJsonPath('not_interested_post_ids', ['post-7']);

        $this->assertSame(['post-7'], $this->prefsFor($user)->not_interested_post_ids);
    }

    public function test_each_action_reuses_a_single_preference_row(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')->postJson('/api/feed-content-preferences/mute', ['handle' => 'alice']);
        $this->actingAs($user, 'sanctum')->postJson('/api/feed-content-preferences/block', ['handle' => 'bob']);

        $this->assertSame(1, FeedContentPreference::query()->where('user_id', $user->id)->count());
        $prefs = $this->prefsFor($user);
        $this->assertSame(['alice'], $prefs->muted_handles);
        $this->assertSame(['bob'], $prefs->blocked_handles);
    }

    public function test_preferences_are_scoped_per_user(): void
    {
        $alice = $this->authUser();
        $bob = User::factory()->create(['handle' => '@bob']);
        $this->actingAs($alice, 'sanctum')->postJson('/api/feed-content-preferences/mute', ['handle' => 'carol']);

        $response = $this->actingAs($bob, 'sanctum')
            ->getJson('/api/feed-content-preferences');

        $response->assertOk()->assertJsonPath('muted_handles', []);
    }
}

