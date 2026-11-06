<?php

namespace Database\Factories;

use App\Models\Boost;
use App\Models\BoostMetric;
use Illuminate\Database\Eloquent\Factories\Factory;

class BoostMetricFactory extends Factory
{
    protected $model = BoostMetric::class;

    public function definition(): array
    {
        return [
            'boost_id' => Boost::factory(),
            'impressions' => fake()->numberBetween(100, 1000),
            'reach' => fake()->numberBetween(80, 800),
            'clicks' => fake()->numberBetween(5, 50),
            'ctr' => function (array $attributes) {
                return $attributes['impressions'] > 0
                    ? round(($attributes['clicks'] / $attributes['impressions']) * 100, 2)
                    : 0.00;
            },
            'date' => now()->toDateString(),
        ];
    }
}
