<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_sender_can_delete_their_message(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $sent = $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Please unsend this',
        ]);
        $sent->assertStatus(201);
        $messageId = $sent->json('id');

        $this->actingAs($sender, 'sanctum')
            ->deleteJson('/api/messages/' . $messageId)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('id', $messageId);

        $this->assertDatabaseMissing('messages', ['id' => $messageId]);
    }

    public function test_recipient_cannot_delete_someone_elses_message(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $messageId = $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Leave this',
        ])->json('id');

        $this->actingAs($recipient, 'sanctum')
            ->deleteJson('/api/messages/' . $messageId)
            ->assertStatus(403);

        $this->assertDatabaseHas('messages', ['id' => $messageId]);
    }
}
