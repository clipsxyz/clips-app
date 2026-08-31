<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

class NotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_save_fcm_token(): void
    {
        $user = User::factory()->create();
        $payload = [
            'token' => 'test-token-123',
            'userId' => $user->id,
            'userHandle' => $user->handle,
        ];

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/fcm-token', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('fcm_tokens', [
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'token' => 'test-token-123',
        ]);
    }

    public function test_save_fcm_token_validates_input(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/fcm-token', []);

        $response->assertStatus(422)
            ->assertJsonStructure(['success', 'errors']);
    }

    public function test_can_remove_fcm_token(): void
    {
        $user = User::factory()->create();
        DB::table('fcm_tokens')->insert([
            'user_id' => (string) $user->id,
            'user_handle' => $user->handle,
            'token' => 'test-token-remove',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $payload = [
            'token' => 'test-token-remove',
            'userId' => (string) $user->id,
            'userHandle' => $user->handle,
            'remove' => true,
        ];

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/fcm-token', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'FCM token removed successfully',
            ]);

        $this->assertDatabaseMissing('fcm_tokens', [
            'user_id' => (string) $user->id,
            'user_handle' => $user->handle,
            'token' => 'test-token-remove',
        ]);
    }

    public function test_can_save_and_get_notification_preferences(): void
    {
        $user = User::factory()->create();
        $payload = [
            'userId' => $user->id,
            'userHandle' => $user->handle,
            'preferences' => [
                'likes' => true,
                'comments' => false,
            ],
        ];

        $saveResponse = $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/preferences', $payload);

        $saveResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('user_notification_settings', [
            'user_id' => $user->id,
            'likes' => 1,
            'comments' => 0,
        ]);

        $getResponse = $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/preferences');

        $getResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('preferences.likes', true)
            ->assertJsonPath('preferences.comments', false);
    }

    public function test_get_own_preferences_returns_defaults_when_none_saved(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/preferences')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('preferences.enabled', true)
            ->assertJsonPath('preferences.directMessages', true)
            ->assertJsonPath('preferences.likes', true);
    }

    public function test_save_preferences_uses_authenticated_user_not_payload_ids(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/preferences', [
                'userId' => $other->id,
                'userHandle' => $other->handle,
                'preferences' => [
                    'likes' => false,
                ],
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('user_notification_settings', [
            'user_id' => $user->id,
            'likes' => 0,
        ]);
        $this->assertDatabaseMissing('user_notification_settings', [
            'user_id' => $other->id,
        ]);
    }

    public function test_get_preferences_returns_null_when_none_exist(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/preferences/@unknown');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'preferences' => null,
            ]);
    }
}

