<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostAudienceEstimateTest extends TestCase
{
    use RefreshDatabase;

    public function test_local_environment_uses_a_minimum_audience_when_nobody_is_nearby(): void
    {
        $this->app['env'] = 'local';
        $owner = User::factory()->create([
            'location_local' => 'Nowhereville',
            'location_regional' => null,
            'location_national' => null,
        ]);

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $owner->id,
            'radiusKm' => 5,
            'durationHours' => 6,
        ])
            ->assertOk()
            ->assertJsonPath('eligibleUsersCount', 150)
            ->assertJsonPath('priceCents', 750);
    }

    public function test_production_keeps_a_real_zero_audience(): void
    {
        $this->app['env'] = 'production';
        $owner = User::factory()->create([
            'location_local' => 'Nowhereville',
            'location_regional' => null,
            'location_national' => null,
        ]);

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $owner->id,
            'radiusKm' => 5,
            'durationHours' => 6,
        ])
            ->assertOk()
            ->assertJsonPath('eligibleUsersCount', 0)
            ->assertJsonPath('priceCents', 0);
    }
}
