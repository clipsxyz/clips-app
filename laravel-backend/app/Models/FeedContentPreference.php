<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedContentPreference extends Model
{
    protected $fillable = [
        'user_id',
        'muted_handles',
        'blocked_handles',
        'hidden_post_ids',
        'not_interested_post_ids',
    ];

    protected $casts = [
        'muted_handles' => 'array',
        'blocked_handles' => 'array',
        'hidden_post_ids' => 'array',
        'not_interested_post_ids' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
