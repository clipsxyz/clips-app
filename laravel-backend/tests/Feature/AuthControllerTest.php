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

    public function test_can_register_then_login_with_same_password(): void
    {
        $this->postJson('/api/auth/register', [
            'username' => 'pariscork',
            'email' => 'Paris.User@example.com',
            'password' => 'gazetteerpass',
            'password_confirmation' => 'gazetteerpass',
            'displayName' => 'Paris',
            'handle' => 'Paris@CountyCork',
        ])->assertStatus(201);

        $this->postJson('/api/auth/login', [
            'email' => 'paris.user@example.com',
            'password' => 'gazetteerpass',
        ])->assertOk()->assertJsonPath('user.email', 'paris.user@example.com');

        $this->postJson('/api/auth/login', [
            'email' => 'Paris@CountyCork',
            'password' => 'gazetteerpass',
        ])->assertOk()->assertJsonPath('user.handle', 'Paris@CountyCork');
    }

    public function test_password_reset_with_code_logs_in(): void
    {
        User::factory()->create([
            'email' => 'otp@example.com',
            'handle' => 'Otp@Dublin',
            'password' => 'oldpassword',
        ]);

        $forgot = $this->postJson('/api/auth/password/forgot', [
            'email' => 'Otp@Dublin',
        ]);
        $forgot->assertOk()->assertJsonStructure(['ok', 'debug_code']);
        $code = $forgot->json('debug_code');
        $this->assertMatchesRegularExpression('/^\d{6}$/', (string) $code);

        $this->postJson('/api/auth/password/reset', [
            'email' => 'otp@example.com',
            'code' => $code,
            'password' => 'newpassword',
            'password_confirmation' => 'newpassword',
        ])->assertOk()->assertJsonStructure(['user' => ['email'], 'token']);

        $this->postJson('/api/auth/login', [
            'email' => 'otp@example.com',
            'password' => 'newpassword',
        ])->assertOk();
    }

    public function test_local_password_reset_logs_in(): void
    {
        User::factory()->create([
            'email' => 'resetme@example.com',
            'handle' => 'Reset@Dublin',
            'password' => 'oldpassword',
        ]);

        $this->postJson('/api/auth/password/reset-local', [
            'email' => 'resetme@example.com',
            'password' => 'newpassword',
            'password_confirmation' => 'newpassword',
        ])->assertOk()->assertJsonStructure(['user' => ['email'], 'token']);

        $this->postJson('/api/auth/login', [
            'email' => 'Reset@Dublin',
            'password' => 'newpassword',
        ])->assertOk();
    }

    public function test_can_login_and_receive_token(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'secret123',
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
