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
        return $this->belongsToMany(Post::class, 'collection_posts', 'collection_id', 'post_id')
                    ->withTimestamps()
                    ->orderBy('collection_posts.created_at', 'desc');
    }

    public static function findOrCreateDefaultForUser(int|string $userId): self
    {
        return static::firstOrCreate(
            ['user_id' => $userId, 'name' => 'All Posts'],
            ['is_private' => true]
        );
    }

    public static function looksLikeVideoUrl(?string $url): bool
    {
        if (!is_string($url) || trim($url) === '') {
            return false;
        }

        return (bool) preg_match('/\.(mp4|webm|mov|m4v)(\?|#|$)/i', $url);
    }

    public function latestCoverPost(): ?Post
    {
        if ($this->relationLoaded('posts')) {
            return $this->posts->first();
        }

        return $this->posts()->first();
    }

    /**
     * Still image for Save sheet / Passport tiles.
     * Prefer an explicit stored cover; otherwise the latest saved post's poster or image.
     */
    public function resolvedCoverUrl(): ?string
    {
        $explicit = is_string($this->thumbnail_url) ? trim($this->thumbnail_url) : '';
        if ($explicit !== '' && !self::looksLikeVideoUrl($explicit)) {
            return $explicit;
        }

        $latest = $this->latestCoverPost();
        if ($latest) {
            $fromPost = $latest->resolvedThumbnailUrl();
            if (is_string($fromPost) && trim($fromPost) !== '' && !self::looksLikeVideoUrl($fromPost)) {
                return trim($fromPost);
            }

            $media = is_string($latest->media_url) ? trim($latest->media_url) : '';
            if ($media !== '' && !self::looksLikeVideoUrl($media)) {
                return $media;
            }
        }

        return $explicit !== '' ? $explicit : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        $cover = $this->resolvedCoverUrl();
        $latest = $this->latestCoverPost();
        $latestThumb = $latest?->resolvedThumbnailUrl();
        if (is_string($latestThumb) && self::looksLikeVideoUrl($latestThumb)) {
            $latestThumb = null;
        }
        $postIds = $this->relationLoaded('posts')
            ? $this->posts->pluck('id')->map(fn ($id) => (string) $id)->values()->all()
            : $this->posts()->pluck('posts.id')->map(fn ($id) => (string) $id)->values()->all();

        $latestPayload = $latest ? [
            'id' => $latest->id,
            'thumbnail_url' => $latestThumb,
            'thumbnailUrl' => $latestThumb,
            'media_url' => $latest->media_url,
            'mediaUrl' => $latest->media_url,
            'media_type' => $latest->media_type,
            'mediaType' => $latest->media_type,
        ] : null;

        $createdMs = $this->created_at ? $this->created_at->timestamp * 1000 : null;
        $updatedMs = $this->updated_at ? $this->updated_at->timestamp * 1000 : null;

        return [
            'id' => (string) $this->id,
            'userId' => $this->user_id,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'isPrivate' => (bool) $this->is_private,
            'is_private' => (bool) $this->is_private,
            'cover_url' => $cover,
            'coverUrl' => $cover,
            'thumbnail_url' => $cover,
            'thumbnailUrl' => $cover,
            'postIds' => $postIds,
            'post_ids' => $postIds,
            'latest_post' => $latestPayload,
            'latestPost' => $latestPayload,
            'createdAt' => $createdMs,
            'created_at' => $createdMs,
            'updatedAt' => $updatedMs,
            'updated_at' => $updatedMs,
        ];
    }

    // Helper methods
    public function containsPost(Post $post)
    {
        return $this->posts()->where('posts.id', $post->id)->exists();
    }

    public function updateThumbnail()
    {
        $latest = $this->posts()->first();
        if (!$latest) {
            $this->thumbnail_url = null;
            $this->save();

            return;
        }

        $fromPost = $latest->resolvedThumbnailUrl();
        if (is_string($fromPost) && trim($fromPost) !== '' && !self::looksLikeVideoUrl($fromPost)) {
            $this->thumbnail_url = trim($fromPost);
            $this->save();

            return;
        }

        $media = is_string($latest->media_url) ? trim($latest->media_url) : '';
        $this->thumbnail_url = ($media !== '' && !self::looksLikeVideoUrl($media)) ? $media : null;
        $this->save();
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

