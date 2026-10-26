<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageReadReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_conversation_read_sets_read_at_and_read_flag(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $sent = $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Did you see this?',
        ]);
        $sent->assertStatus(201);
        $this->assertFalse((bool) $sent->json('read'));
        $this->assertNull($sent->json('read_at'));

        $unreadHistory = $this->actingAs($sender, 'sanctum')
            ->getJson('/api/messages/conversation/' . rawurlencode($recipient->handle));
        $unreadHistory->assertOk();
        $this->assertFalse((bool) $unreadHistory->json('0.read'));
        $this->assertNull($unreadHistory->json('0.read_at'));

        $mark = $this->actingAs($recipient, 'sanctum')
            ->postJson('/api/messages/conversation/' . rawurlencode($sender->handle) . '/read');
        $mark->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('marked', 1);

        $readHistory = $this->actingAs($sender, 'sanctum')
            ->getJson('/api/messages/conversation/' . rawurlencode($recipient->handle));
        $readHistory->assertOk();
        $this->assertTrue((bool) $readHistory->json('0.read'));
        $this->assertNotNull($readHistory->json('0.read_at'));

        $again = $this->actingAs($recipient, 'sanctum')
            ->postJson('/api/messages/conversation/' . rawurlencode($sender->handle) . '/read');
        $again->assertOk()->assertJsonPath('marked', 0);
    }
}
