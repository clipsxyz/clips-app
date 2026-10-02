<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Post extends Model
{
    /**
     * Hops to walk below a region when resolving descendants. The gazetteer is
     * admin_level 0 (Country) -> 1|2 (County/Region) -> 3 (City/District), so four
     * levels covers the deepest possible chain. Also bounds parent_id cycles.
     */
    public const MAX_REGION_DEPTH = 4;

    use HasFactory, SoftDeletes;

    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (Post $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->public_share_token)) {
                $model->public_share_token = Str::random(48);
            }
        });
    }

    protected $fillable = [
        'public_share_token',
        'user_id',
        'user_handle',
        'text_content',
        'media_url',
        'media_type',
        'thumbnail_url',
        'location_label',
        'place_id',
        'width',
        'height',
        'aspect_ratio',
        'dominant_color',
        'gazetteer_region_id',
        'latitude',
        'longitude',
        'venue',
        'landmark',
        'social_format',
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
        'latitude' => 'float',
        // Intrinsic media dimensions, read from container metadata on upload.
        // width/height are authoritative; aspect_ratio is a redundant convenience copy.
        'width' => 'integer',
        'height' => 'integer',
        'aspect_ratio' => 'float',
        'longitude' => 'float',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * JPEG poster for video grid tiles: stored column, then media_items poster, then image URL.
     */
    public function resolvedThumbnailUrl(): ?string
    {
        if (is_string($this->thumbnail_url) && trim($this->thumbnail_url) !== '') {
            return $this->thumbnail_url;
        }

        $items = is_array($this->media_items) ? $this->media_items : [];
        $first = is_array($items[0] ?? null) ? $items[0] : null;
        if (is_array($first)) {
            foreach (['posterUrl', 'poster_url', 'thumbnail_url', 'thumbnailUrl'] as $key) {
                if (! empty($first[$key]) && is_string($first[$key])) {
                    return $first[$key];
                }
            }
        }

        if ($this->media_type === 'image' && is_string($this->media_url) && $this->media_url !== '') {
            return $this->media_url;
        }

        return null;
    }

    /** withCount aliases so they do not collide with posts.likes_count columns. */
    public static function engagementWithCounts(): array
    {
        return [
            'likes as likes_rel_count',
            'comments as comments_rel_count',
            'shares as shares_rel_count',
            'views as views_rel_count',
            'reclips as reclips_rel_count',
        ];
    }

    /** Home tab refetches the feed; bump this so stale cached zeros are not served. */
    public static function bumpFeedCache(): void
    {
        Cache::put('feed_version', (int) Cache::get('feed_version', 0) + 1);
    }

    /**
     * Prefer the greater of the denormalized column and the relationship count.
     *
     * @param  array<string, mixed>  $postData
     * @param  array<string, mixed>  $attrs
     * @return array<string, mixed>
     */
    public static function applyEngagementCounts(array $postData, array $attrs): array
    {
        foreach (['likes', 'comments', 'shares', 'views', 'reclips'] as $metric) {
            $col = $metric.'_count';
            $rel = $metric.'_rel_count';
            $postData[$col] = max((int) ($attrs[$col] ?? $postData[$col] ?? 0), (int) ($attrs[$rel] ?? 0));
        }

        return $postData;
    }

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The gazetteer region this post was taken in.
     *
     * Nullable and not yet populated: every existing post has a NULL here, and nothing
     * writes to it yet. Location filtering still goes through scopeByLocation(), which
     * LIKE-matches the free-text location_label / venue / landmark strings.
     */
    public function gazetteerRegion(): BelongsTo
    {
        return $this->belongsTo(GazetteerRegion::class, 'gazetteer_region_id');
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
            ->withPivot('id', 'user_handle')
            ->withTimestamps();
    }

    /**
     * Attach tagged users with required pivot UUID (post_tagged_users.id is NOT NULL).
     *
     * @param  array<string, string>  $userIdToHandle  user id => handle
     */
    public function attachTaggedUsersPivot(array $userIdToHandle): void
    {
        if ($userIdToHandle === []) {
            return;
        }

        $payload = [];
        foreach ($userIdToHandle as $userId => $handle) {
            if ($this->taggedUsers()->where('user_id', $userId)->exists()) {
                continue;
            }
            $payload[$userId] = [
                'id' => (string) Str::uuid(),
                'user_handle' => $handle,
            ];
        }

        if ($payload !== []) {
            $this->taggedUsers()->attach($payload);
        }
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
        $raw = trim((string) $location);
        if ($raw === '') {
            return $query;
        }

        if (str_starts_with(strtolower($raw), 'venue:')) {
            $needle = $this->primaryPlaceTag(trim(substr($raw, 6)));
            if ($needle === '') {
                return $query;
            }

            return $query->where(function ($q) use ($needle) {
                $q->where('venue', 'LIKE', "%{$needle}%")
                    ->orWhereRaw('LOWER(TRIM(venue)) = ?', [strtolower($needle)]);
            });
        }

        if (str_starts_with(strtolower($raw), 'landmark:')) {
            $needle = $this->primaryPlaceTag(trim(substr($raw, 9)));
            if ($needle === '') {
                return $query;
            }

            return $query->where(function ($q) use ($needle) {
                $q->where('landmark', 'LIKE', "%{$needle}%")
                    ->orWhereRaw('LOWER(TRIM(landmark)) = ?', [strtolower($needle)]);
            });
        }

        $needle = $raw;

        return $query->where(function ($q) use ($needle) {
            $q->where('location_label', 'LIKE', "%{$needle}%")
                ->orWhere('venue', 'LIKE', "%{$needle}%")
                ->orWhere('landmark', 'LIKE', "%{$needle}%")
                ->orWhere('place_id', $needle)
                ->orWhereHas('user', function ($uq) use ($needle) {
                    $uq->where('location_local', 'LIKE', "%{$needle}%")
                        ->orWhere('location_regional', 'LIKE', "%{$needle}%")
                        ->orWhere('location_national', 'LIKE', "%{$needle}%");
                });
        });
    }

    /**
     * Short place label for venue/landmark feed filters (drop ", City, Country" suffix).
     */
    private function primaryPlaceTag(string $raw): string
    {
        $primary = trim(explode(',', $raw)[0] ?? $raw);
        $primary = preg_replace(
            '/\s+(railway station|train station|bus station|metro station|airport|international airport|station)$/i',
            '',
            $primary
        ) ?? $primary;

        return trim($primary);
    }

    public function scopeFollowing($query, $userId)
    {
        return $query->whereHas('user.followers', function ($q) use ($userId) {
            $q->where('follower_id', $userId);
        });
    }

    /**
     * Posts tagged with $regionId directly, OR tagged with any region beneath it.
     *
     * The gazetteer is a Country (admin_level 0) -> County (1) -> City (3) tree linked by
     * gazetteer_regions.parent_id. There is no materialised path column, so descendants
     * are resolved by walking parent_id downwards one level per query and accumulating
     * ids until a level comes back empty.
     *
     * Deliberately self-contained: nothing in the existing feed path calls this yet and
     * no controller or route has been wired up to it.
     *
     * Fails closed. A null, empty or non-numeric $regionId yields NO posts rather than
     * all posts, so a missing filter value can never silently return the whole feed.
     * scopeByLocation() returns the query untouched for an empty string, which is fine
     * for a text search but the wrong direction for a scoping filter.
     *
     * The walk is bounded at 4 levels, matching the admin_level 0-3 design, and that
     * bound is also what makes this safe against a parent_id cycle:
     * gazetteer_regions.parent_id is a plain self-referencing FK with nothing stopping
     * A -> B -> A, and an unbounded walk would never terminate. A cycle truncates the
     * result set rather than hanging.
     *
     * NULL gazetteer_region_id never matches (SQL three-valued logic), so untagged posts
     * are excluded from every region filter.
     *
     * Uses whereIntegerInRaw-style accumulation via orWhereIn, so this stays a single
     * posts query plus one gazetteer_regions query per level -- no recursive CTE, which
     * would need different SQL on pgsql vs mysql and does not exist in older MySQL.
     *
     * @param  int|string|null  $regionId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInRegion($query, $regionId)
    {
        $ids = $this->regionIdsWithDescendants($regionId);

        return $query->whereIn($this->getTable().'.gazetteer_region_id', $ids);
    }

    /**
     * $regionId plus every descendant region id, breadth-first.
     *
     * Bounded by MAX_REGION_DEPTH hops. Returns an empty array for a bad $regionId so
     * scopeInRegion() then matches nothing rather than everything.
     *
     * @param  int|string|null  $regionId
     * @return array<int>
     */
    public function regionIdsWithDescendants($regionId)
    {
        if (! is_numeric($regionId) || (int) $regionId <= 0) {
            return [];
        }

        $region = new GazetteerRegion;

        $frontier = [(int) $regionId];
        $seen = $frontier;
        $depth = 0;

        while ($frontier && $depth < self::MAX_REGION_DEPTH) {
            $children = $region->newQuery()
                ->whereIn('parent_id', $frontier)
                ->pluck('id')
                ->all();

            // array_diff also drops ids already seen, so a parent_id cycle cannot make
            // the frontier grow without bound even before the depth cap is reached.
            $frontier = array_values(array_diff($children, $seen));
            $seen = array_merge($seen, $frontier);
            $depth++;
        }

        return array_values($seen);
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
