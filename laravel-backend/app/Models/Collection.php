<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Collection extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'is_private',
        'thumbnail_url',
    ];

    protected $casts = [
        'is_private' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function posts()
    {
        return $this->belongsToMany(Post::class, 'collection_posts')
                    ->withTimestamps()
                    ->orderBy('collection_posts.created_at', 'desc');
    }

    // Helper methods
    public function containsPost(Post $post)
    {
        return $this->posts()->where('post_id', $post->id)->exists();
    }

    public function updateThumbnail()
    {
        $firstPost = $this->posts()->first();
        if ($firstPost && $firstPost->media_url) {
            $this->thumbnail_url = $firstPost->media_url;
            $this->save();
        } elseif (!$firstPost) {
            $this->thumbnail_url = null;
            $this->save();
        }
    }

    // Scopes
    public function scopePublic($query)
    {
        return $query->where('is_private', false);
    }

    public function scopePrivate($query)
    {
        return $query->where('is_private', true);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }
}

