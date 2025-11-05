<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'user_id',
        'user_handle',
        'text_content',
        'parent_id',
        'likes_count',
        'replies_count',
    ];

    protected $casts = [
        'likes_count' => 'integer',
        'replies_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }

    public function likes()
    {
        return $this->belongsToMany(User::class, 'comment_likes')
                    ->withTimestamps();
    }

    // Scopes
    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeReplies($query)
    {
        return $query->whereNotNull('parent_id');
    }

    // Helper methods
    public function isLikedBy(User $user)
    {
        return $this->likes()->where('user_id', $user->id)->exists();
    }

    public function isReply()
    {
        return !is_null($this->parent_id);
    }

    public function isTopLevel()
    {
        return is_null($this->parent_id);
    }

    // Notifications relationship
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }
}
