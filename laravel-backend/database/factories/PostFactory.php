<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        $user = User::factory()->create();
        return [
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => $this->faker->optional()->sentence,
            'media_url' => $this->faker->optional()->imageUrl(),
            'media_type' => $this->faker->randomElement(['image', 'video']),
            'location_label' => $this->faker->city,
            'tags' => [],
            'likes_count' => 0,
            'views_count' => 0,
            'comments_count' => 0,
            'shares_count' => 0,
            'reclips_count' => 0,
            'is_reclipped' => false,
        ];
    }

    public function video(): static
    {
        return $this->state(fn (array $attributes) => [
            'media_type' => 'video',
            'media_url' => 'https://example.com/video.mp4',
        ]);
    }

    public function withEditTimeline(): static
    {
        return $this->state(fn (array $attributes) => [
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
        ]);
    }
}

