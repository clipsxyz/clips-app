<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostScratchTest extends TestCase
{
    use RefreshDatabase;

    public function test_dump_estimate_response(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ]);

        fwrite(STDERR, "\n>>> STATUS ".$response->getStatusCode()."\n>>> BODY ".$response->getContent()."\n");
        $this->assertTrue(true);
    }
}
