<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_requires_query(): void
    {
        $this->getJson('/api/locations/search')
            ->assertStatus(422);
    }

    public function test_search_returns_gazetteer_matches(): void
    {
        $response = $this->getJson('/api/locations/search?q=Dublin&limit=10');

        $response->assertOk();
        $this->assertIsArray($response->json());
        $names = collect($response->json())->pluck('name')->implode(' ');
        $this->assertTrue(
            str_contains(strtolower($names), 'dublin'),
            'Expected a Dublin gazetteer hit, got: '.$names
        );
    }

    public function test_geocode_requires_place_id_or_query(): void
    {
        $this->getJson('/api/locations/geocode')
            ->assertStatus(422)
            ->assertJsonPath('error', 'place_id or q is required');
    }

    public function test_geocode_returns_not_found_when_unresolved(): void
    {
        $this->getJson('/api/locations/geocode?q=zzzxnotaplace999')
            ->assertStatus(404)
            ->assertJsonPath('error', 'Location not found');
    }

    public function test_details_requires_place_id(): void
    {
        $this->getJson('/api/locations/details')
            ->assertStatus(422);
    }
}
