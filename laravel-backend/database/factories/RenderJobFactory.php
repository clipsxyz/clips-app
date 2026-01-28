<?php

namespace Database\Factories;

use App\Models\RenderJob;
use App\Models\User;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class RenderJobFactory extends Factory
{
    protected $model = RenderJob::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'post_id' => Post::factory(),
            'status' => 'queued',
            'edit_timeline' => [
                'clips' => [
                    [
                        'id' => 'clip-1',
                        'mediaUrl' => 'https://example.com/video.mp4',
                        'type' => 'video',
                        'startTime' => 0,
                        'duration' => 10,
                        'trimStart' => 0,
                        'trimEnd' => 10,
                        'speed' => 1.0,
                        'reverse' => false,
                    ]
                ],
                'transitions' => [],
                'totalDuration' => 10,
            ],
            'video_source_url' => 'https://example.com/source.mp4',
        ];
    }

    public function rendering(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'rendering',
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'final_video_url' => 'https://example.com/rendered.mp4',
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'failed',
            'error_message' => 'FFmpeg processing failed',
        ]);
    }
}

