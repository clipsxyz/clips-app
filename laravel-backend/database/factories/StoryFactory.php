<?php

namespace Database\Factories;

use App\Models\Story;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class StoryFactory extends Factory
{
    protected $model = Story::class;

    public function definition(): array
    {
        $user = User::factory()->create();
        return [
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'media_url' => null,
            'media_type' => null,
            'text' => $this->faker->optional(0.7)->sentence,
            'text_color' => '#ffffff',
            'text_size' => 'medium',
            'location' => null,
            'views_count' => 0,
            'expires_at' => now()->addDay(),
            'shared_from_post_id' => null,
            'shared_from_user_handle' => null,
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subMinute(),
        ]);
    }

    public function withMedia(): static
    {
        return $this->state(fn (array $attributes) => [
            'media_url' => $this->faker->imageUrl(),
            'media_type' => 'image',
        ]);
    }
}
