<?php

namespace Database\Seeders;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

class BoostAnalyticsSeeder extends Seeder
{
    /**
     * Seed one active boost and a week of daily metrics for analytics tests.
     */
    public function run(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();

        Boost::factory()
            ->forPost($post)
            ->active()
            ->withMetrics(7)
            ->create();
    }
}
