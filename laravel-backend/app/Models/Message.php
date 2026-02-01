<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'sender_handle',
        'recipient_handle',
        'text',
        'image_url',
        'is_system_message',
        'read_at',
    ];

    protected $casts = [
        'is_system_message' => 'boolean',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_handle', 'handle');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_handle', 'handle');
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


