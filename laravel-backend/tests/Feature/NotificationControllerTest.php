<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Notification;
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

    public function test_save_preferences_drops_legacy_questions_key(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications/preferences', [
                'userId' => $user->id,
                'userHandle' => $user->handle,
                'preferences' => [
                    'likes' => true,
                    'questions' => false,
                ],
            ])
            ->assertOk();

        $prefs = $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/preferences/' . $user->handle)
            ->assertOk()
            ->assertJsonPath('preferences.likes', true)
            ->json('preferences');

        $this->assertIsArray($prefs);
        $this->assertArrayNotHasKey('questions', $prefs);
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

    public function test_unread_count_excludes_thread_activity_notifications(): void
    {
        $user = User::factory()->create();

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'like',
            'from_handle' => 'Alice@Cork',
            'to_handle' => $user->handle,
            'read' => false,
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'dm',
            'from_handle' => 'Bob@Dublin',
            'to_handle' => $user->handle,
            'read' => false,
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'follow',
            'from_handle' => 'Cara@Galway',
            'to_handle' => $user->handle,
            'read' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJson(['count' => 1]);
    }

    public function test_owner_can_delete_a_notification(): void
    {
        $user = User::factory()->create();
        $notification = Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'like',
            'from_handle' => 'Alice@Cork',
            'to_handle' => $user->handle,
            'read' => false,
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/notifications/' . $notification->id)
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('notifications', [
            'id' => $notification->id,
        ]);
    }

    public function test_user_cannot_delete_another_users_notification(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $notification = Notification::query()->create([
            'user_id' => $owner->id,
            'type' => 'like',
            'from_handle' => 'Alice@Cork',
            'to_handle' => $owner->handle,
            'read' => false,
        ]);

        $this->actingAs($other, 'sanctum')
            ->deleteJson('/api/notifications/' . $notification->id)
            ->assertStatus(404);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
        ]);
    }
}

