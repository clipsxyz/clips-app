<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Story extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (Story $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'user_id',
        'user_handle',
        'media_url',
        'media_type',
        'video_poster_url',
        'text',
        'text_color',
        'text_size',
        'location',
        'venue',
        'views_count',
        'expires_at',
        'shared_from_post_id',
        'shared_from_user_handle',
        'text_style', // JSON: { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'stickers', // JSON array of StickerOverlay objects
        'tagged_users', // JSON array of user handles
        'tagged_users_positions', // JSON array of { handle, x, y }
        'audience', // public | close_friends | only_me
        'link_preview',
    ];

    protected $casts = [
        'views_count' => 'integer',
        'expires_at' => 'datetime',
        'text_style' => 'array', // { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'stickers' => 'array', // Array of StickerOverlay objects
        'tagged_users' => 'array', // Array of user handles
        'tagged_users_positions' => 'array',
        'link_preview' => 'array',
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

    // Scopes — 24h window in UTC so SQLite/MySQL timezone offsets cannot
    // treat a just-created story as already expired.
    public function scopeActive($query)
    {
        return $query->where('created_at', '>=', now('UTC')->subHours(24));
    }

    public function scopeExpired($query)
    {
        return $query->where('created_at', '<', now('UTC')->subHours(24));
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByMediaType($query, $type)
    {
        return $query->where('media_type', $type);
    }

    /**
     * Audience: public = everyone; close_friends = author's followers; only_me = author.
     * Combine with User::constrainAuthorVisibility for private profiles.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeVisibleToAudience($query, ?string $viewerId)
    {
        return $query->where(function ($outer) use ($viewerId) {
            $outer->where(function ($public) {
                $public->whereNull('audience')
                    ->orWhere('audience', 'public');
            });

            if ($viewerId) {
                $outer->orWhere('user_id', $viewerId)
                    ->orWhere(function ($followersOnly) use ($viewerId) {
                        $followersOnly->where('audience', 'close_friends')
                            ->whereIn('user_id', function ($sub) use ($viewerId) {
                                $sub->select('following_id')
                                    ->from('user_follows')
                                    ->where('follower_id', $viewerId)
                                    ->where('status', 'accepted');
                            });
                    });
            }
        });
    }

    // Helper methods
    public function isActive()
    {
        return $this->created_at && $this->created_at->gte(now('UTC')->subHours(24));
    }

    public function isExpired()
    {
        return !$this->isActive();
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


