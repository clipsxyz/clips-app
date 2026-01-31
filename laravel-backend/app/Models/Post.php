<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Post extends Model
{
    use HasFactory, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (Post $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

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
        'original_user_handle',
        'reclipped_by',
        'banner_text',
        'stickers',
        'template_id',
        'media_items',
        'caption',
        'image_text',
        'text_style', // JSON: { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'video_captions_enabled',
        'video_caption_text',
        'subtitles_enabled',
        'subtitle_text',
        'edit_timeline', // JSON: Edit timeline for hybrid editing pipeline (clips, trims, transitions, etc.)
        'render_job_id', // Reference to render job
        'final_video_url', // Final rendered video URL
        'music_track_id', // Reference to music track from library
        'music_attribution', // Attribution text for music track
    ];

    protected $casts = [
        'tags' => 'array',
        'stickers' => 'array',
        'media_items' => 'array',
        'text_style' => 'array', // { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        'edit_timeline' => 'array', // Edit timeline for hybrid editing pipeline
        'likes_count' => 'integer',
        'views_count' => 'integer',
        'comments_count' => 'integer',
        'shares_count' => 'integer',
        'reclips_count' => 'integer',
        'is_reclipped' => 'boolean',
        'video_captions_enabled' => 'boolean',
        'subtitles_enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
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
        return $this->belongsToMany(User::class, 'post_shares')
                    ->withTimestamps();
    }

    public function views()
    {
        return $this->belongsToMany(User::class, 'post_views')
                    ->withTimestamps();
    }

    public function reclips()
    {
        return $this->belongsToMany(User::class, 'post_reclips')
                    ->withPivot('user_handle')
                    ->withTimestamps();
    }

    public function originalPost()
    {
        return $this->belongsTo(Post::class, 'original_post_id');
    }

    public function reclippedPosts()
    {
        return $this->hasMany(Post::class, 'original_post_id');
    }

    // Tagged users relationship (many-to-many)
    public function taggedUsers()
    {
        return $this->belongsToMany(User::class, 'post_tagged_users')
                    ->withPivot('user_handle')
                    ->withTimestamps();
    }

    // Music track relationship
    public function musicTrack()
    {
        return $this->belongsTo(Music::class, 'music_track_id');
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

    /** Whether the post author follows the given viewer (for mutual follow / DM icon). Only accepted follows count. */
    public function authorFollowsViewer(User $user)
    {
        return DB::table('user_follows')
            ->where('follower_id', $this->user_id)
            ->where('following_id', $user->id)
            ->where('status', 'accepted')
            ->exists();
    }

    // Notifications relationship
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    // Stories relationship (posts that were shared as stories)
    public function sharedAsStories()
    {
        return $this->hasMany(Story::class, 'shared_from_post_id');
    }

    // Collections relationships
    public function collections()
    {
        return $this->belongsToMany(Collection::class, 'collection_posts')
                    ->withTimestamps()
                    ->orderBy('collection_posts.created_at', 'desc');
    }

    // Render job relationship
    public function renderJob()
    {
        return $this->belongsTo(RenderJob::class, 'render_job_id');
    }

    // Helper method to check if post is in a collection
    public function isInCollection(Collection $collection)
    {
        return $this->collections()->where('collection_id', $collection->id)->exists();
    }
}
