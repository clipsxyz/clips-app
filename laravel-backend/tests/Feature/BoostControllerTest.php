<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private function signIn(): User
    {
        $this->user = User::factory()->create(['handle' => '@boostuser']);
        $this->actingAs($this->user, 'sanctum');
        return $this->user;
    }

    public function test_estimate_rejects_invalid_feed_type(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'galaxy',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertStatus(422);
    }

    public function test_estimate_rejects_invalid_duration(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 5,
        ])->assertStatus(422);
    }

    public function test_estimate_rejects_zero_radius(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 0,
            'durationHours' => 6,
        ])->assertStatus(422);
    }

    public function test_estimate_returns_price_cents_for_valid_input(): void
    {
        $this->signIn();

        $this->postJson('/api/boost/estimate', [
            'feedType' => 'local',
            'userId' => $this->user->id,
            'radiusKm' => 10,
            'durationHours' => 6,
        ])->assertOk()
            ->assertJsonStructure([
                'eligibleUsersCount',
                'priceCents',
                'priceEur',
            ]);
    }

    public function test_active_ids_returns_empty_without_boosts(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/active-ids?feedType=local')
            ->assertOk()
            ->assertJsonStructure(['postIds' => []]);
    }

    public function test_active_ids_rejects_invalid_feed_type(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/active-ids?feedType=galaxy')
            ->assertStatus(400)
            ->assertJson(['error' => 'Invalid feed type']);
    }

    public function test_status_returns_inactive_for_unknown_post(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/status/unknown-post')
            ->assertOk()
            ->assertJson([
                'isActive' => false,
                'timeRemaining' => 0,
                'feedType' => null,
                'activatedAt' => null,
                'expiresAt' => null,
            ]);
    }

    public function test_status_requires_a_post_id(): void
    {
        $this->signIn();

        $this->getJson('/api/boost/status/')
            ->assertStatus(404);
    }
}
