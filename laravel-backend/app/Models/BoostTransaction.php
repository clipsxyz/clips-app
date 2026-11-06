<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoostTransaction extends Model
{
    protected $fillable = [
        'stripe_session_id',
        'post_id',
        'user_id',
        'radius',
        'tier',
        'duration',
        'amount_cents',
        'currency',
        'paid_at',
    ];

    protected $casts = [
        'radius' => 'float',
        'duration' => 'integer',
        'amount_cents' => 'integer',
        'paid_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
