<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    public function test_me_returns_live_follow_counts_when_columns_are_stale(): void
    {
        $user = User::factory()->create([
            'followers_count' => 0,
            'following_count' => 0,
        ]);
        $follower = User::factory()->create();
        $following = User::factory()->create();

        DB::table('user_follows')->insert([
            [
                'follower_id' => $follower->id,
                'following_id' => $user->id,
                'status' => 'accepted',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'follower_id' => $user->id,
                'following_id' => $following->id,
                'status' => 'accepted',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'id' => $user->id,
                'followers_count' => 1,
                'following_count' => 1,
            ]);

        $this->assertEquals(1, $user->fresh()->followers_count);
        $this->assertEquals(1, $user->fresh()->following_count);
    }

    public function test_contact_match_accepts_irish_local_numbers_and_unverified_phones(): void
    {
        $viewer = User::factory()->create(['handle' => 'Viewer@Dublin']);
        $friend = User::factory()->create([
            'handle' => 'Donny@NewYorkState',
            'phone_number' => '+353871234567',
            'phone_verified_at' => null,
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/auth/contacts/match', [
                'phones' => ['087 123 4567'],
            ]);

        $response->assertOk()
            ->assertJsonPath('matched_count', 1)
            ->assertJsonPath('matched.0.handle', 'Donny@NewYorkState');

        $this->assertSame($friend->id, $response->json('matched.0.id'));
    }

    public function test_register_with_invite_credits_inviter_and_follows(): void
    {
        $inviter = User::factory()->create([
            'handle' => 'Gazetteer@Dublin',
            'followers_count' => 0,
        ]);

        $response = $this->postJson('/api/auth/register', [
            'username' => 'invitee',
            'email' => 'invitee@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'displayName' => 'Invitee',
            'handle' => 'Invitee@Cork',
            'invite' => 'Gazetteer@Dublin',
        ]);

        $response->assertStatus(201);

        $invitee = User::query()->where('email', 'invitee@example.com')->first();
        $this->assertNotNull($invitee);
        $this->assertSame($inviter->id, $invitee->invited_by_user_id);
        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $invitee->id,
            'following_id' => $inviter->id,
            'status' => 'accepted',
        ]);
        $this->assertEquals(1, $invitee->fresh()->following_count);
        $this->assertEquals(1, $inviter->fresh()->followers_count);
    }

    public function test_authenticated_user_can_change_password(): void
    {
        $user = User::factory()->create([
            'email' => 'changepass@example.com',
            'handle' => 'Change@Dublin',
            'password' => 'oldpassword',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/auth/change-password', [
                'current_password' => 'wrong-old',
                'new_password' => 'newpassword1',
                'confirm_password' => 'newpassword1',
            ])
            ->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/auth/change-password', [
                'current_password' => 'oldpassword',
                'new_password' => 'newpassword1',
                'confirm_password' => 'newpassword1',
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->postJson('/api/auth/login', [
            'email' => 'changepass@example.com',
            'password' => 'newpassword1',
        ])->assertOk();
    }

    public function test_authenticated_user_can_remove_verified_phone(): void
    {
        $user = User::factory()->create([
            'handle' => 'Phone@Dublin',
            'phone_number' => '+353871234567',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/auth/phone/remove')
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'phone_number' => null,
                'phone_verified_at' => null,
            ]);

        $fresh = $user->fresh();
        $this->assertNull($fresh?->phone_number);
        $this->assertNull($fresh?->phone_verified_at);
    }

    public function test_logout_revokes_current_access_token(): void
    {
        $user = User::factory()->create([
            'email' => 'logout@example.com',
            'password' => 'password123',
        ]);
        $plain = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJson(['message' => 'Successfully logged out']);

        $this->assertSame(0, $user->tokens()->count());

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }
}
