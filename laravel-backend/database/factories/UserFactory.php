<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'username' => $this->faker->unique()->userName,
            'email' => $this->faker->unique()->safeEmail,
            'password' => Hash::make('password'),
            'display_name' => $this->faker->name,
            'handle' => '@' . $this->faker->unique()->userName,
            'bio' => $this->faker->optional()->sentence,
            'avatar_url' => $this->faker->optional()->imageUrl(),
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
            'is_verified' => false,
            'is_private' => false,
            'followers_count' => 0,
            'following_count' => 0,
            'posts_count' => 0,
        ];
    }
}

