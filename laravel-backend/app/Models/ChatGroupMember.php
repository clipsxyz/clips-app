<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ChatGroupMember extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (ChatGroupMember $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'chat_group_id',
        'user_id',
        'role',
        'last_read_at',
        'left_at',
    ];

    protected $casts = [
        'last_read_at' => 'datetime',
        'left_at' => 'datetime',
    ];

    public function chatGroup()
    {
        return $this->belongsTo(ChatGroup::class, 'chat_group_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
