<?php

namespace App\Events;

use App\Models\Message;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        if ($this->message->chat_group_id) {
            return [new PrivateChannel('chat.group.'.$this->message->chat_group_id)];
        }

        $channels = [];
        foreach ([$this->message->sender_handle, $this->message->recipient_handle] as $handle) {
            if (! is_string($handle) || $handle === '') {
                continue;
            }
            $userId = User::query()->where('handle', $handle)->value('id');
            if ($userId) {
                $channels[] = new PrivateChannel('chat.user.'.$userId);
            }
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'MessageSent';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'chat_group_id' => $this->message->chat_group_id,
            'sender_handle' => $this->message->sender_handle,
            'recipient_handle' => $this->message->recipient_handle,
            'text' => $this->message->text,
            'image_url' => $this->message->image_url,
            'is_system_message' => (bool) $this->message->is_system_message,
            'reply_to' => $this->message->reply_to,
            'created_at' => optional($this->message->created_at)?->toJSON(),
            'updated_at' => optional($this->message->updated_at)?->toJSON(),
        ];
    }
}
