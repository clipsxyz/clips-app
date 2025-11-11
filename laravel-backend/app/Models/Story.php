<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'user_handle',
        'media_url',
        'media_type',
        'text',
        'text_color',
        'text_size',
        'location',
        'views_count',
        'expires_at',
        'shared_from_post_id',
        'shared_from_user_handle',
        'text_style', // JSON: { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'stickers', // JSON array of StickerOverlay objects
        'tagged_users', // JSON array of user handles
    ];

    protected $casts = [
        'views_count' => 'integer',
        'expires_at' => 'datetime',
        'text_style' => 'array', // { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'stickers' => 'array', // Array of StickerOverlay objects
        'tagged_users' => 'array', // Array of user handles
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sharedFromPost()
    {
        return $this->belongsTo(Post::class, 'shared_from_post_id');
    }

    public function reactions()
    {
        return $this->hasMany(StoryReaction::class);
    }

    public function replies()
    {
        return $this->hasMany(StoryReply::class);
    }

    public function views()
    {
        return $this->hasMany(StoryView::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('expires_at', '>', now());
    }

    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<=', now());
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByMediaType($query, $type)
    {
        return $query->where('media_type', $type);
    }

    // Helper methods
    public function isActive()
    {
        return $this->expires_at > now();
    }

    public function isExpired()
    {
        return $this->expires_at <= now();
    }

    public function hasBeenViewedBy(User $user)
    {
        return $this->views()->where('user_id', $user->id)->exists();
    }

    public function getUserReaction(User $user)
    {
        return $this->reactions()->where('user_id', $user->id)->first();
    }
}


