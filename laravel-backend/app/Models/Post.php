<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_handle',
        'text_content',
        'media_url',
        'media_type',
        'location_label',
        'tags',
        'likes_count',
        'views_count',
        'comments_count',
        'shares_count',
        'reclips_count',
        'is_reclipped',
        'original_post_id',
        'reclipped_by',
    ];

    protected $casts = [
        'tags' => 'array',
        'likes_count' => 'integer',
        'views_count' => 'integer',
        'comments_count' => 'integer',
        'shares_count' => 'integer',
        'reclips_count' => 'integer',
        'is_reclipped' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function likes()
    {
        return $this->belongsToMany(User::class, 'post_likes')
                    ->withTimestamps();
    }

    public function bookmarks()
    {
        return $this->belongsToMany(User::class, 'post_bookmarks')
                    ->withTimestamps();
    }

    public function shares()
    {
        return $this->hasMany(PostShare::class);
    }

    public function views()
    {
        return $this->hasMany(PostView::class);
    }

    public function reclips()
    {
        return $this->hasMany(PostReclip::class);
    }

    public function originalPost()
    {
        return $this->belongsTo(Post::class, 'original_post_id');
    }

    public function reclippedPosts()
    {
        return $this->hasMany(Post::class, 'original_post_id');
    }

    // Scopes
    public function scopeNotReclipped($query)
    {
        return $query->where('is_reclipped', false);
    }

    public function scopeByLocation($query, $location)
    {
        return $query->where('location_label', 'LIKE', "%{$location}%");
    }

    public function scopeFollowing($query, $userId)
    {
        return $query->whereHas('user.followers', function ($q) use ($userId) {
            $q->where('follower_id', $userId);
        });
    }

    // Helper methods
    public function isLikedBy(User $user)
    {
        return $this->likes()->where('user_id', $user->id)->exists();
    }

    public function isBookmarkedBy(User $user)
    {
        return $this->bookmarks()->where('user_id', $user->id)->exists();
    }

    public function isViewedBy(User $user)
    {
        return $this->views()->where('user_id', $user->id)->exists();
    }

    public function isReclippedBy(User $user)
    {
        return $this->reclips()->where('user_id', $user->id)->exists();
    }

    public function isFollowingAuthor(User $user)
    {
        return $this->user->followers()->where('follower_id', $user->id)->exists();
    }
}
