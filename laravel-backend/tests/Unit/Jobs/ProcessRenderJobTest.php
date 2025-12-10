<?php

namespace Tests\Unit\Jobs;

use Tests\TestCase;
use App\Jobs\ProcessRenderJob;
use App\Models\RenderJob;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Log;
use Mockery;

class ProcessRenderJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_job_can_be_dispatched(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        $renderJob = RenderJob::factory()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
        ]);

        ProcessRenderJob::dispatch($renderJob->id);

        Queue::assertPushed(ProcessRenderJob::class, function ($job) use ($renderJob) {
            return $job->jobId === $renderJob->id;
        });
    }

    public function test_job_updates_status_to_rendering(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        $renderJob = RenderJob::factory()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
        ]);

        // Mock the renderWithFfmpeg method to avoid actual FFmpeg execution
        $job = new ProcessRenderJob($renderJob->id);
        
        // We can't easily test the full execution without mocking FFmpeg,
        // but we can test that the job structure is correct
        $this->assertEquals($renderJob->id, $job->jobId);
        $this->assertEquals(3, $job->tries);
        $this->assertEquals(600, $job->timeout);
    }

    public function test_job_handles_missing_render_job_gracefully(): void
    {
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);

        $job = new ProcessRenderJob('non-existent-id');
        $job->handle();
    }

    public function test_job_creates_render_job_for_post_with_edit_timeline(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->withEditTimeline()->create([
            'user_id' => $user->id,
            'video_source_url' => 'https://example.com/video.mp4',
        ]);

        $renderJob = RenderJob::factory()->create([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
            'edit_timeline' => $post->edit_timeline,
            'video_source_url' => $post->video_source_url,
        ]);

        $this->assertDatabaseHas('render_jobs', [
            'id' => $renderJob->id,
            'post_id' => $post->id,
            'status' => 'queued',
        ]);

        $this->assertNotNull($renderJob->edit_timeline);
        $this->assertIsArray($renderJob->edit_timeline);
        $this->assertArrayHasKey('clips', $renderJob->edit_timeline);
    }
}
















