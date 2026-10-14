<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Message extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (Message $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'conversation_id',
        'chat_group_id',
        'sender_handle',
        'recipient_handle',
        'text',
        'image_url',
        'is_system_message',
        'reply_to_message_id',
        'read_at',
    ];

    protected $casts = [
        'is_system_message' => 'boolean',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** Serialized quote preview so DM clients can render the reply context after reload. */
    protected $appends = ['reply_to'];

    // Relationships
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_handle', 'handle');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_handle', 'handle');
    }

    public function chatGroup()
    {
        return $this->belongsTo(ChatGroup::class, 'chat_group_id');
    }

    public function replyToMessage()
    {
        return $this->belongsTo(Message::class, 'reply_to_message_id');
    }

    public function isGroupMessage(): bool
    {
        return $this->chat_group_id !== null;
    }

    /**
     * Compact quote preview attached to the message payload.
     * Returns null when this message is not a reply (or the parent is gone).
     */
    public function getReplyToAttribute(): ?array
    {
        if (empty($this->reply_to_message_id)) {
            return null;
        }

        /** @var Message|null $parent */
        $parent = $this->relationLoaded('replyToMessage')
            ? $this->getRelation('replyToMessage')
            : $this->replyToMessage;

        if (! $parent) {
            return null;
        }

        $imageUrl = $parent->image_url;
        $mediaType = null;
        if (! empty($imageUrl)) {
            $mediaType = preg_match('/\.(mp4|webm|m4v|mov)(\?|#|$)/i', (string) $imageUrl) ? 'video' : 'image';
        }

        return [
            'messageId' => (string) $parent->id,
            'text' => (string) ($parent->text ?? ''),
            'senderHandle' => (string) $parent->sender_handle,
            'imageUrl' => $imageUrl,
            'mediaType' => $mediaType,
        ];
    }

    // Scopes
    public function scopeForConversation($query, $conversationId)
    {
        return $query->where('conversation_id', $conversationId);
    }

    public function scopeForUser($query, $handle)
    {
        return $query->where(function ($q) use ($handle) {
            $q->where('sender_handle', $handle)
              ->orWhere('recipient_handle', $handle);
        });
    }

    public function scopeSystemMessages($query)
    {
        return $query->where('is_system_message', true);
    }

    public function scopeRegularMessages($query)
    {
        return $query->where('is_system_message', false);
    }

    // Helper methods
    public static function getConversationId($handle1, $handle2)
    {
        $handles = [$handle1, $handle2];
        sort($handles);
        return implode('|', $handles);
    }
}


