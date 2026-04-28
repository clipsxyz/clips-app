<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ChatGroup extends Model
{
    use SoftDeletes;

    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (ChatGroup $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->conversation_id)) {
                $model->conversation_id = static::conversationIdFor($model->id);
            }
        });
    }

    protected $fillable = [
        'name',
        'avatar_url',
        'creator_id',
        'conversation_id',
    ];

    protected $casts = [
        'deleted_at' => 'datetime',
    ];

    public static function conversationIdFor(string $groupId): string
    {
        return 'grp:' . $groupId;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function members()
    {
        return $this->hasMany(ChatGroupMember::class, 'chat_group_id');
    }

    public function activeMembers()
    {
        return $this->members()->whereNull('left_at');
    }

    public function invites()
    {
        return $this->hasMany(ChatGroupInvite::class, 'chat_group_id');
    }

    public function messages()
    {
        return $this->hasMany(Message::class, 'chat_group_id');
    }

    public function isAdmin(User $user): bool
    {
        return $this->creator_id === $user->id;
    }

    public function hasActiveMember(User $user): bool
    {
        return $this->activeMembers()->where('user_id', $user->id)->exists();
    }
}
