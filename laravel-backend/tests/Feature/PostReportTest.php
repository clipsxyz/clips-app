<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostReportTest extends TestCase
{
    use RefreshDatabase;

    private function authUser(): User
    {
        return User::factory()->create(['handle' => '@alice']);
    }

    private function postFor(User $user): Post
    {
        return Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);
    }

    public function test_store_creates_report(): void
    {
        $user = $this->authUser();
        $post = $this->postFor($user);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts/'.$post->id.'/report', [
                'reason' => 'spam',
                'details' => 'Repeated spam content',
            ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('post_reports', [
            'reporter_user_id' => $user->id,
            'post_id' => $post->id,
            'reason' => 'spam',
            'details' => 'Repeated spam content',
        ]);
    }

    public function test_store_rejects_blank_post_id(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts/   /report', ['reason' => 'spam'])
            ->assertStatus(422)
            ->assertJsonPath('error', 'post_id required');
    }

    public function test_store_returns_404_for_missing_post(): void
    {
        $user = $this->authUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts/does-not-exist/report', ['reason' => 'spam'])
            ->assertStatus(404)
            ->assertJsonPath('error', 'Post not found');
    }

    public function test_store_updates_existing_report_instead_of_duplicating(): void
    {
        $user = $this->authUser();
        $post = $this->postFor($user);
        PostReport::create([
            'reporter_user_id' => $user->id,
            'post_id' => $post->id,
            'reason' => 'spam',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts/'.$post->id.'/report', ['reason' => 'harassment', 'details' => 'Updated'])
            ->assertOk();

        $this->assertSame(1, PostReport::query()->where('reporter_user_id', $user->id)->where('post_id', $post->id)->count());
        $this->assertDatabaseHas('post_reports', [
            'reporter_user_id' => $user->id,
            'post_id' => $post->id,
            'reason' => 'harassment',
            'details' => 'Updated',
        ]);
    }

    public function test_store_truncates_reason_to_64_chars(): void
    {
        $user = $this->authUser();
        $post = $this->postFor($user);
        $longReason = str_repeat('x', 200);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts/'.$post->id.'/report', ['reason' => $longReason])
            ->assertOk();

        $report = PostReport::query()->where('reporter_user_id', $user->id)->firstOrFail();
        $this->assertSame(64, mb_strlen((string) $report->reason));
    }
}

