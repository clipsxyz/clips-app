<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Boost extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'feed_type',
        'price',
        'radius_km',
        'center_local',
        'eligible_users_count',
        'duration_hours',
        'impressions_count',
        'likes_count',
        'comments_count',
        'shares_count',
        'last_analytics_event_at',
        'payment_intent_id',
        'activated_at',
        'expires_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'activated_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_analytics_event_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive($query)
    {
        return $query->where('expires_at', '>', now());
    }

    public function scopeForFeedType($query, string $feedType)
    {
        return $query->where('feed_type', $feedType);
    }
}
