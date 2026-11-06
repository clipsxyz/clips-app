<?php

namespace Database\Factories;

use App\Models\Boost;
use App\Models\BoostMetric;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class BoostFactory extends Factory
{
    protected $model = Boost::class;

    public function definition(): array
    {
        return [
            'post_id' => Post::factory(),
            'user_id' => function (array $attributes) {
                return Post::query()->whereKey($attributes['post_id'])->value('user_id');
            },
            'feed_type' => 'local',
            'status' => 'active',
            'price' => 4.99,
            'radius_km' => 5,
            'duration_hours' => 6,
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ];
    }

    public function forPost(Post $post): static
    {
        return $this->state([
            'post_id' => $post->id,
            'user_id' => $post->user_id,
        ]);
    }

    public function active(): static
    {
        return $this->state([
            'activated_at' => now()->subMinutes(5),
            'expires_at' => now()->addHours(6),
        ]);
    }

    public function withMetrics(int $days = 1): static
    {
        return $this->afterCreating(function (Boost $boost) use ($days) {
            for ($offset = 0; $offset < $days; $offset++) {
                BoostMetric::factory()->create([
                    'boost_id' => $boost->id,
                    'date' => now()->subDays($offset)->toDateString(),
                ]);
            }
        });
    }
}
