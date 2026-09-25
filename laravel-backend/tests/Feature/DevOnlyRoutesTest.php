<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DevOnlyRoutesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed a user so the handle-enumeration path has data to leak if unguarded.
        User::factory()->create(['handle' => '@leaky']);
    }

    public function test_boost_test_user_route_is_blocked_in_production(): void
    {
        app()->detectEnvironment(fn () => 'production');

        $this->getJson('/api/dev/boost-test-user')->assertNotFound();

        $this->assertDatabaseMissing('users', ['email' => 'boosttest@example.com']);
    }

    public function test_ava_follows_barry_route_is_blocked_in_production(): void
    {
        app()->detectEnvironment(fn () => 'production');

        $this->getJson('/api/dev/ava-follows-barry')->assertNotFound();
    }

    public function test_boost_test_user_route_works_in_local(): void
    {
        app()->detectEnvironment(fn () => 'local');

        $this->getJson('/api/dev/boost-test-user')
            ->assertOk()
            ->assertJsonStructure(['email', 'password', 'post_id']);
    }

    public function test_dev_routes_do_not_leak_stack_traces(): void
    {
        app()->detectEnvironment(fn () => 'local');

        $response = $this->getJson('/api/dev/boost-test-user');

        $this->assertStringNotContainsString('trace', $response->getContent());
    }
}
