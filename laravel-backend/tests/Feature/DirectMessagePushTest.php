<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use App\Services\FirebaseNotificationService;
use App\Services\InteractionPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class DirectMessagePushTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_sending_a_dm_dispatches_fcm_with_conversation_payload(): void
    {
        $sender = User::factory()->create(['handle' => 'Alice@Cork']);
        $recipient = User::factory()->create(['handle' => 'Bob@Dublin']);
        $conversationId = Message::getConversationId($sender->handle, $recipient->handle);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->with(
                (string) $recipient->id,
                'Alice@Cork',
                'Hello from Alice',
                Mockery::on(function (array $data) use ($conversationId, $sender) {
                    return ($data['type'] ?? null) === 'dm'
                        && ($data['conversation_id'] ?? null) === $conversationId
                        && ($data['sender_id'] ?? null) === (string) $sender->id;
                })
            )
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);

        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/messages/send', [
                'recipient_handle' => $recipient->handle,
                'text' => 'Hello from Alice',
            ])
            ->assertStatus(201);
    }

    public function test_attachment_dm_uses_sent_an_attachment_body(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $message = new Message([
            'conversation_id' => Message::getConversationId($sender->handle, $recipient->handle),
            'sender_handle' => $sender->handle,
            'recipient_handle' => $recipient->handle,
            'text' => null,
            'image_url' => 'https://cdn.example.com/clip.mp4',
            'is_system_message' => false,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->withArgs(function (string $userId, string $title, string $body) use ($recipient, $sender) {
                return $userId === (string) $recipient->id
                    && $title === (string) $sender->handle
                    && $body === 'Sent an attachment';
            })
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);

        (new InteractionPushService($fcm))->notifyDirectMessage($sender, $recipient, $message);
        $this->addToAssertionCount(1);
    }

    public function test_system_messages_do_not_send_push(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $message = new Message([
            'conversation_id' => Message::getConversationId($sender->handle, $recipient->handle),
            'sender_handle' => $sender->handle,
            'recipient_handle' => $recipient->handle,
            'text' => 'system',
            'is_system_message' => true,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')->never();

        (new InteractionPushService($fcm))->notifyDirectMessage($sender, $recipient, $message);
        $this->addToAssertionCount(1);
    }
}
