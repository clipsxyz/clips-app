<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Comment extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (Comment $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'post_id',
        'user_id',
        'user_handle',
        'text_content',
        'parent_id',
        'likes_count',
        'replies_count',
        'moderation_status',
        'is_hidden',
        'flagged_keywords',
    ];

    protected $casts = [
        'likes_count' => 'integer',
        'replies_count' => 'integer',
        'is_hidden' => 'boolean',
        'flagged_keywords' => 'array',
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

    /**
     * Public listing: hide pending/hidden rows unless the viewer owns the post.
     */
    public function scopeVisibleTo($query, ?User $viewer, ?string $postOwnerId)
    {
        if ($viewer && $postOwnerId && (string) $viewer->id === (string) $postOwnerId) {
            return $query;
        }

        return $query->where('is_hidden', false)
            ->where(function ($inner) {
                $inner->whereNull('moderation_status')
                    ->orWhere('moderation_status', 'approved');
            });
    }

    public function isHiddenFromPublic(): bool
    {
        if ($this->is_hidden) {
            return true;
        }
        $status = (string) ($this->moderation_status ?: 'approved');

        return in_array($status, ['hidden', 'pending_review'], true);
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
