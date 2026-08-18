<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_register_and_receive_token(): void
    {
        $payload = [
            'username' => 'newuser',
            'email' => 'newuser@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'displayName' => 'New User',
            'handle' => '@newuser',
            'locationLocal' => ' Finglas ',
            'locationRegional' => 'Dublin',
            'locationNational' => 'Ireland',
        ];

        $response = $this->postJson('/api/auth/register', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'user' => ['id', 'username', 'email', 'handle', 'display_name', 'location_local', 'location_regional', 'location_national'],
                'token',
            ])
            ->assertJson([
                'user' => [
                    'username' => 'newuser',
                    'email' => 'newuser@example.com',
                    'handle' => '@newuser',
                    'location_local' => 'Finglas',
                    'location_regional' => 'Dublin',
                    'location_national' => 'Ireland',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'username' => 'newuser',
            'email' => 'newuser@example.com',
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
    }

    public function test_can_login_and_receive_token(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => ['id', 'email'],
                'token',
            ])
            ->assertJson([
                'user' => ['email' => 'login@example.com'],
            ]);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrong',
        ]);

        $response->assertStatus(401)
            ->assertJson(['error' => 'Invalid credentials']);
    }

    public function test_me_returns_current_user_when_authenticated(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJsonStructure(['id', 'username', 'email', 'handle'])
            ->assertJson(['id' => $user->id]);
    }
}
