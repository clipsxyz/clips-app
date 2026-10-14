<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageReplyTest extends TestCase
{
    use RefreshDatabase;

    private function makeUsers(): array
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        return [$sender, $recipient];
    }

    private function sendMessage(User $sender, User $recipient, array $payload): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', array_merge([
            'recipient_handle' => $recipient->handle,
        ], $payload));
    }

    public function test_reply_is_persisted_and_returned(): void
    {
        [$sender, $recipient] = $this->makeUsers();

        $original = $this->sendMessage($sender, $recipient, ['text' => 'Original message']);
        $original->assertStatus(201);
        $originalId = $original->json('id');

        $reply = $this->sendMessage($sender, $recipient, [
            'text' => 'This is a reply',
            'reply_to_message_id' => $originalId,
        ]);

        $reply->assertStatus(201)
            ->assertJsonPath('reply_to.messageId', $originalId)
            ->assertJsonPath('reply_to.text', 'Original message')
            ->assertJsonPath('reply_to.senderHandle', $sender->handle);

        $this->assertDatabaseHas('messages', [
            'id' => $reply->json('id'),
            'reply_to_message_id' => $originalId,
        ]);
    }

    public function test_conversation_history_includes_reply_preview(): void
    {
        [$sender, $recipient] = $this->makeUsers();

        $originalId = $this->sendMessage($sender, $recipient, ['text' => 'Hello there'])->json('id');

        $this->sendMessage($sender, $recipient, [
            'text' => 'Quoting you',
            'reply_to_message_id' => $originalId,
        ])->assertStatus(201);

        $response = $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/messages/conversation/' . urlencode($sender->handle));

        $response->assertStatus(200);

        $reply = collect($response->json())->firstWhere('reply_to.messageId', $originalId);
        $this->assertNotNull($reply);
        $this->assertSame('Hello there', $reply['reply_to']['text']);
    }

    public function test_reply_to_message_outside_conversation_is_rejected(): void
    {
        [$sender, $recipient] = $this->makeUsers();
        $stranger = User::factory()->create();

        $originalId = $this->sendMessage($stranger, $recipient, ['text' => 'Unrelated'])->json('id');

        $this->sendMessage($sender, $recipient, [
            'text' => 'Sneaky reply',
            'reply_to_message_id' => $originalId,
        ])->assertStatus(400);

        $this->assertDatabaseMissing('messages', [
            'text' => 'Sneaky reply',
        ]);
    }

    public function test_unknown_reply_target_is_rejected(): void
    {
        [$sender, $recipient] = $this->makeUsers();

        $this->sendMessage($sender, $recipient, [
            'text' => 'Bad target',
            'reply_to_message_id' => (string) \Illuminate\Support\Str::uuid(),
        ])->assertStatus(400);
    }

    public function test_group_reply_is_persisted(): void
    {
        $creator = User::factory()->create();
        $group = \App\Models\ChatGroup::create([
            'name' => 'Test Group',
            'creator_id' => $creator->id,
        ]);
        \App\Models\ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $creator->id,
            'role' => 'admin',
        ]);

        $first = $this->actingAs($creator, 'sanctum')->postJson('/api/messages/send', [
            'chat_group_id' => $group->id,
            'text' => 'First group message',
        ]);
        $first->assertStatus(201);
        $firstId = $first->json('id');

        $reply = $this->actingAs($creator, 'sanctum')->postJson('/api/messages/send', [
            'chat_group_id' => $group->id,
            'text' => 'Group reply',
            'reply_to_message_id' => $firstId,
        ]);

        $reply->assertStatus(201)
            ->assertJsonPath('reply_to.messageId', $firstId);

        $this->assertDatabaseHas('messages', [
            'id' => $reply->json('id'),
            'reply_to_message_id' => $firstId,
        ]);
    }
}
