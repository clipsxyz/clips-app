<?php

namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\RenderJob;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

class RenderJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_render_job_can_be_created(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $renderJob = RenderJob::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
            'edit_timeline' => [
                'clips' => [
                    [
                        'id' => 'clip-1',
                        'mediaUrl' => 'https://example.com/video.mp4',
                        'type' => 'video',
                        'trimStart' => 0,
                        'trimEnd' => 10,
                        'speed' => 1.0,
                        'reverse' => false,
                    ]
                ],
            ],
            'video_source_url' => 'https://example.com/source.mp4',
        ]);

        $this->assertDatabaseHas('render_jobs', [
            'id' => $renderJob->id,
            'status' => 'queued',
            'post_id' => $post->id,
        ]);
    }

    public function test_render_job_belongs_to_user(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        
        $renderJob = RenderJob::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
        ]);

        $this->assertInstanceOf(User::class, $renderJob->user);
        $this->assertEquals($user->id, $renderJob->user->id);
    }

    public function test_render_job_belongs_to_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        
        $renderJob = RenderJob::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
        ]);

        $this->assertInstanceOf(Post::class, $renderJob->post);
        $this->assertEquals($post->id, $renderJob->post->id);
    }

    public function test_render_job_casts_edit_timeline_to_array(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        
        $editTimeline = [
            'clips' => [
                [
                    'id' => 'clip-1',
                    'mediaUrl' => 'https://example.com/video.mp4',
                    'type' => 'video',
                ]
            ],
        ];

        $renderJob = RenderJob::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
            'edit_timeline' => $editTimeline,
        ]);

        $this->assertIsArray($renderJob->edit_timeline);
        $this->assertEquals($editTimeline, $renderJob->edit_timeline);
    }

    public function test_render_job_status_can_be_updated(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);
        
        $renderJob = RenderJob::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'post_id' => $post->id,
            'status' => 'queued',
        ]);

        $renderJob->status = 'rendering';
        $renderJob->save();

        $this->assertEquals('rendering', $renderJob->status);
    }
}

