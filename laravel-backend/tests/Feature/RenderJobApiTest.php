<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Post;
use App\Models\RenderJob;
use Illuminate\Foundation\Testing\RefreshDatabase;

class RenderJobApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_get_render_job_status(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        $renderJob = RenderJob::factory()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'rendering',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/render-jobs/{$renderJob->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'status',
                'post_id',
            ])
            ->assertJson([
                'status' => 'rendering',
                'id' => $renderJob->id,
            ]);
    }

    public function test_returns_404_for_nonexistent_render_job(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/render-jobs/' . (string) \Illuminate\Support\Str::uuid());

        $response->assertStatus(404);
    }

    public function test_returns_completed_status_with_final_video_url(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        $renderJob = RenderJob::factory()->completed()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'final_video_url' => 'https://example.com/rendered.mp4',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/render-jobs/{$renderJob->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'completed',
                'final_video_url' => 'https://example.com/rendered.mp4',
            ]);
    }

    public function test_returns_failed_status_with_error_message(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        $renderJob = RenderJob::factory()->failed()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'error_message' => 'FFmpeg processing failed',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/render-jobs/{$renderJob->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'failed',
                'error_message' => 'FFmpeg processing failed',
            ]);
    }
}

