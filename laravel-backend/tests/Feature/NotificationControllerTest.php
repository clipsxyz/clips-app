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

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);

        $getResponse = $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/preferences/' . $user->handle);

        $getResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'preferences' => [
                    'likes' => true,
                    'comments' => false,
                ],
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

