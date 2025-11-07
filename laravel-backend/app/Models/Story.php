<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    use HasFactory;

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
    ];

    protected $casts = [
        'views_count' => 'integer',
        'expires_at' => 'datetime',
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


