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

    public function test_opening_a_conversation_marks_incoming_messages_read(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Open me',
        ])->assertStatus(201);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/messages/conversation/' . rawurlencode($sender->handle) . '/paged?limit=20')
            ->assertOk();

        $list = $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/messages/conversations?limit=20');
        $list->assertOk();
        $row = collect($list->json('items'))->firstWhere('type', 'dm');
        $this->assertNotNull($row);
        $this->assertSame(0, (int) ($row['unread_count'] ?? -1));
    }

    public function test_read_threads_stay_listed_and_unread_counts_only_incoming(): void
    {
        $alice = User::factory()->create();
        $barry = User::factory()->create();

        $this->actingAs($alice, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $barry->handle,
            'text' => 'Still unread',
        ])->assertStatus(201);

        $this->actingAs($barry, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $alice->handle,
            'text' => 'Reply before opening',
        ])->assertStatus(201);

        $beforeOpen = $this->actingAs($barry, 'sanctum')
            ->getJson('/api/messages/conversations?limit=20');
        $beforeOpen->assertOk();
        $pending = collect($beforeOpen->json('items'))->firstWhere('type', 'dm');
        $this->assertNotNull($pending);
        $this->assertSame(1, (int) ($pending['unread_count'] ?? -1));

        $this->actingAs($barry, 'sanctum')
            ->getJson('/api/messages/conversation/' . rawurlencode($alice->handle) . '/paged?limit=20')
            ->assertOk();

        $afterOpen = $this->actingAs($barry, 'sanctum')
            ->getJson('/api/messages/conversations?limit=20');
        $afterOpen->assertOk();
        $read = collect($afterOpen->json('items'))->firstWhere('type', 'dm');
        $this->assertNotNull($read);
        $this->assertSame(0, (int) ($read['unread_count'] ?? -1));
    }
}
