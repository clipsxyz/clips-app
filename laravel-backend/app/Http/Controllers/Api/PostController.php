<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Models\RenderJob;
use App\Jobs\ProcessRenderJob;
use App\Services\BoostAnalyticsService;
use App\Services\GoogleMapsLocationService;
use App\Services\InteractionPushService;
use App\Services\VideoThumbnailService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Support\Str;
use Carbon\Carbon;

class PostController extends Controller
{
    /** Author fields the feed needs so Ireland/Dublin tabs can match Cork (etc.) from user location, not handle guessing. */
    private const FEED_USER_WITH = 'user:id,handle,display_name,avatar_url,location_local,location_regional,location_national';

    private function buildPublicShareUrl(string $token): string
    {
        $base = rtrim((string) (config('app.frontend_url') ?: config('app.url') ?: ''), '/');
        return $base !== '' ? ($base . '/p/' . $token) : ('/p/' . $token);
    }

    /**
     * Resolve place_id / location label to lat/lng via Google (cached in location_centroids).
     *
     * @return array{place_id: ?string, latitude: ?float, longitude: ?float, location_label: ?string}
     */
    private function resolvePostGeoFields(Request $request): array
    {
        $placeId = trim((string) ($request->input('placeId') ?? $request->input('place_id') ?? ''));
        $location = trim((string) ($request->input('location') ?? ''));
        $latIn = $request->input('latitude');
        $lngIn = $request->input('longitude');

        $out = [
            'place_id' => $placeId !== '' ? $placeId : null,
            'latitude' => is_numeric($latIn) ? (float) $latIn : null,
            'longitude' => is_numeric($lngIn) ? (float) $lngIn : null,
            'location_label' => $location !== '' ? $location : null,
        ];

        if ($out['latitude'] !== null && $out['longitude'] !== null && $out['place_id'] !== null) {
            return $out;
        }

        $maps = new GoogleMapsLocationService;
        $resolved = $maps->resolve($out['place_id'], $out['location_label']);
        if ($resolved === null) {
            return $out;
        }

        return [
            'place_id' => $out['place_id'] ?: ($resolved['place_id'] ?? null),
            'latitude' => $out['latitude'] ?? ($resolved['latitude'] ?? null),
            'longitude' => $out['longitude'] ?? ($resolved['longitude'] ?? null),
            'location_label' => $out['location_label']
                ?: (isset($resolved['display_name']) ? (string) $resolved['display_name'] : null)
                ?: (isset($resolved['label']) ? (string) $resolved['label'] : null),
        ];
    }

    /**
     * Normalize a post model for feed / suggestion API responses (snake_case + relations).
     */
    public static function toApiArray(Post $post, ?User $viewer): array
    {
        $postData = $post->toArray();
        $attrs = $post->getAttributes();
        $postData['public_share_token'] = $post->public_share_token;
        $postData['venue'] = $post->venue;
        $postData['landmark'] = $post->landmark;
        $postData['place_id'] = $post->place_id;
        $postData['latitude'] = $post->latitude;
        $postData['longitude'] = $post->longitude;
        $postData['placeId'] = $post->place_id;
        $postData['taggedUsers'] = $post->relationLoaded('taggedUsers')
            ? $post->taggedUsers->pluck('handle')->toArray()
            : [];
        if ($viewer) {
            $postData['user_liked'] = array_key_exists('user_liked', $attrs)
                ? (bool) $attrs['user_liked']
                : ($post->relationLoaded('likes')
                ? $post->likes->isNotEmpty()
                : $post->isLikedBy($viewer));
            $postData['is_bookmarked'] = array_key_exists('is_bookmarked', $attrs)
                ? (bool) $attrs['is_bookmarked']
                : ($post->relationLoaded('bookmarks')
                ? $post->bookmarks->isNotEmpty()
                : $post->isBookmarkedBy($viewer));
            $postData['is_following'] = array_key_exists('is_following', $attrs)
                ? (bool) $attrs['is_following']
                : ($post->relationLoaded('user') && $post->user && $post->user->relationLoaded('followers')
                ? $post->user->followers->isNotEmpty()
                : $post->isFollowingAuthor($viewer));
            $postData['author_follows_you'] = array_key_exists('author_follows_you', $attrs)
                ? (bool) $attrs['author_follows_you']
                : $post->authorFollowsViewer($viewer);
            $postData['user_reclipped'] = array_key_exists('user_reclipped', $attrs)
                ? (bool) $attrs['user_reclipped']
                : ($post->relationLoaded('reclips')
                ? $post->reclips->isNotEmpty()
                : $post->isReclippedBy($viewer));
        } else {
            $postData['user_liked'] = false;
            $postData['is_bookmarked'] = false;
            $postData['is_following'] = false;
            $postData['author_follows_you'] = false;
            $postData['user_reclipped'] = false;
        }

        $poster = $post->resolvedThumbnailUrl();
        $postData['thumbnail_url'] = $poster;
        $postData['video_poster_url'] = $poster;
        $postData['poster_url'] = $poster;

        $postData = Post::applyEngagementCounts($postData, $attrs);

        if ($post->relationLoaded('user') && $post->user) {
            $author = $post->user;
            $postData['user'] = [
                'id' => $author->id,
                'handle' => $author->handle,
                'display_name' => $author->display_name,
                'avatar_url' => $author->avatar_url,
                'local' => $author->location_local,
                'regional' => $author->location_regional,
                'national' => $author->location_national,
                'location_local' => $author->location_local,
                'location_regional' => $author->location_regional,
                'location_national' => $author->location_national,
            ];
        }

        return $postData;
    }

    /**
     * Get posts with pagination and filtering
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cursor' => 'nullable|string',
            'limit' => 'integer|min:1|max:50',
            'filter' => 'nullable|string|max:200',
            'userId' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $cursor = (string) $request->get('cursor', '');
            $limit = $request->get('limit', 10);
            $filter = $request->get('filter', 'Dublin');
            $userId = $request->get('userId');
            if ($userId === null && Auth::check()) {
                $userId = Auth::id();
            }
            if ($userId === null && $request->bearerToken()) {
                try {
                    $token = PersonalAccessToken::findToken($request->bearerToken());
                    if ($token && $token->tokenable) {
                        $userId = $token->tokenable->id;
                    }
                } catch (\Throwable $e) {
                    // ignore
                }
            }
            $cursorState = $this->decodeFeedCursor($cursor);

            // Do not cache feed pages: likes/views/comments/shares change constantly,
            // and Home refetches this endpoint. A 5-minute cache served stale zeros.
            $response = $this->buildFeedResponse($cursorState, $limit, $filter, $userId);

            return response()->json($response);
        } catch (\Throwable $e) {
            \Log::warning('posts index failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'items' => [],
                'nextCursor' => null,
                'hasMore' => false,
                'followingCount' => 0,
            ]);
        }
    }

    /**
     * Build feed items and nextCursor (used by index with Laravel Cache).
     */
    private function buildFeedResponse(array $cursorState, int $limit, string $filter, ?string $userId): array
    {
            $hasViewer = !empty($userId);
            $isFollowingFeed = $this->isFollowingFeedFilter($filter);
            $followingCount = 0;
            if ($hasViewer) {
                $followingCount = (int) DB::table('user_follows')
                    ->where('follower_id', $userId)
                    ->where('status', 'accepted')
                    ->count();
            }

            // Following feed: include both original and reclipped posts from people you follow (reclips appear for your followers).
            // Location feeds: only original posts from that location.
            $query = Post::query()
                ->with([self::FEED_USER_WITH, 'taggedUsers:id,handle,display_name,avatar_url'])
                ->withCount(Post::engagementWithCounts());

            if ($isFollowingFeed) {
                if ($hasViewer) {
                    $query->following($userId);
                } else {
                    // Guest Following must be empty — never dump the public location feed.
                    $query->whereRaw('0 = 1');
                }
            } else {
                $query->notReclipped()->byLocation($filter);
            }

            if ($hasViewer) {
                $query->withExists([
                    'likes as user_liked' => function ($q) use ($userId) {
                        $q->where('users.id', $userId);
                    },
                    'bookmarks as is_bookmarked' => function ($q) use ($userId) {
                        $q->where('users.id', $userId);
                    },
                    'reclips as user_reclipped' => function ($q) use ($userId) {
                        $q->where('users.id', $userId);
                    },
                ])
                ->selectRaw(
                    "exists(select 1 from user_follows uf where uf.following_id = posts.user_id and uf.follower_id = ? and uf.status = 'accepted') as is_following",
                    [$userId]
                )
                ->selectRaw(
                    "exists(select 1 from user_follows uf where uf.follower_id = posts.user_id and uf.following_id = ? and uf.status = 'accepted') as author_follows_you",
                    [$userId]
                );
            }

            if ($cursorState['created_at'] && $cursorState['id']) {
                $query->where(function ($q) use ($cursorState) {
                    $q->where('created_at', '<', $cursorState['created_at'])
                      ->orWhere(function ($q2) use ($cursorState) {
                          $q2->where('created_at', '=', $cursorState['created_at'])
                             ->where('id', '<', $cursorState['id']);
                      });
                });
            } elseif ($cursorState['page'] > 0) {
                // Backward compatibility for old numeric page cursors.
                $query->offset($cursorState['page'] * $limit);
            }

            $posts = $query->orderBy('created_at', 'desc')
                ->orderBy('id', 'desc')
                ->limit($limit)
                ->get()
                ->unique('id')
                ->values();

            $userModel = $hasViewer ? User::find($userId) : null;
            $transformedPosts = $posts->map(fn (Post $post) => self::toApiArray($post, $userModel));

            $lastPost = $posts->last();
            $nextCursor = null;
            if ($posts->count() === $limit && $lastPost) {
                $nextCursor = $this->encodeFeedCursor($lastPost->created_at, (string) $lastPost->id);
            }

            return [
                'items' => $transformedPosts,
                'nextCursor' => $nextCursor,
                'hasMore' => $nextCursor !== null,
                'followingCount' => $followingCount,
            ];
    }

    private function isFollowingFeedFilter(string $filter): bool
    {
        $normalized = strtolower(trim($filter));

        return $normalized === 'following' || $normalized === 'discover';
    }

    private function decodeFeedCursor(?string $cursor): array
    {
        $cursorValue = trim((string) ($cursor ?? ''));
        if ($cursorValue === '' || $cursorValue === '0') {
            return ['created_at' => null, 'id' => null, 'page' => 0];
        }

        if (ctype_digit($cursorValue)) {
            return ['created_at' => null, 'id' => null, 'page' => (int) $cursorValue];
        }

        $encoded = strtr($cursorValue, '-_', '+/');
        $padding = strlen($encoded) % 4;
        if ($padding > 0) {
            $encoded .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($encoded, true);
        if ($decoded === false || !str_contains($decoded, '|')) {
            return ['created_at' => null, 'id' => null, 'page' => 0];
        }

        [$createdAtRaw, $id] = explode('|', $decoded, 2);
        if (!$id || !Str::isUuid($id)) {
            return ['created_at' => null, 'id' => null, 'page' => 0];
        }

        try {
            $createdAt = Carbon::parse($createdAtRaw)->toDateTimeString();
        } catch (\Throwable $e) {
            return ['created_at' => null, 'id' => null, 'page' => 0];
        }

        return ['created_at' => $createdAt, 'id' => $id, 'page' => 0];
    }

    private function encodeFeedCursor($createdAt, string $id): string
    {
        $createdAtString = $createdAt instanceof \DateTimeInterface
            ? $createdAt->format('Y-m-d H:i:s')
            : Carbon::parse((string) $createdAt)->format('Y-m-d H:i:s');
        return rtrim(strtr(base64_encode($createdAtString . '|' . $id), '+/', '-_'), '=');
    }

    /**
     * Get single post
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $userId = $request->get('userId');
        $hasViewer = !empty($userId);
        
        $query = Post::with([self::FEED_USER_WITH, 'taggedUsers:id,handle,display_name,avatar_url'])
            ->withCount(Post::engagementWithCounts());

        if ($hasViewer) {
            $query->withExists([
                'likes as user_liked' => function ($q) use ($userId) {
                    $q->where('users.id', $userId);
                },
                'bookmarks as is_bookmarked' => function ($q) use ($userId) {
                    $q->where('users.id', $userId);
                },
                'reclips as user_reclipped' => function ($q) use ($userId) {
                    $q->where('users.id', $userId);
                },
            ])
            ->selectRaw(
                "exists(select 1 from user_follows uf where uf.following_id = posts.user_id and uf.follower_id = ? and uf.status = 'accepted') as is_following",
                [$userId]
            )
            ->selectRaw(
                "exists(select 1 from user_follows uf where uf.follower_id = posts.user_id and uf.following_id = ? and uf.status = 'accepted') as author_follows_you",
                [$userId]
            );
        }

        $post = $query->findOrFail($id);
        $userModel = $hasViewer ? User::find($userId) : null;
        return response()->json(self::toApiArray($post, $userModel));
    }

    /**
     * Get public post preview by share token.
     */
    public function showPublicByToken(Request $request, string $token): JsonResponse
    {
        if (!is_string($token) || strlen($token) < 16) {
            return response()->json(['error' => 'Post not found'], 404);
        }

        $post = Post::query()
            ->with([self::FEED_USER_WITH])
            ->withCount(Post::engagementWithCounts())
            ->where('public_share_token', $token)
            ->first();

        if (!$post) {
            return response()->json(['error' => 'Post not found'], 404);
        }

        $counts = Post::applyEngagementCounts($post->toArray(), $post->getAttributes());

        // Public preview payload only (safe guest fields).
        return response()->json([
            'id' => $post->id,
            'public_share_token' => $post->public_share_token,
            'user_handle' => $post->user_handle,
            'display_name' => $post->user?->display_name,
            'avatar_url' => $post->user?->avatar_url,
            'text_content' => $post->text_content,
            'caption' => $post->caption,
            'image_text' => $post->image_text,
            'media_url' => $post->media_url,
            'media_type' => $post->media_type,
            'media_items' => $post->media_items,
            'location_label' => $post->location_label,
            'venue' => $post->venue,
            'landmark' => $post->landmark,
            'likes_count' => $counts['likes_count'],
            'comments_count' => $counts['comments_count'],
            'shares_count' => $counts['shares_count'],
            'views_count' => $counts['views_count'],
            'reclips_count' => $counts['reclips_count'],
            'created_at' => optional($post->created_at)->toISOString(),
        ]);
    }

    /**
     * Create new post
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'text' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:200',
            'placeId' => 'nullable|string|max:255',
            'place_id' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'venue' => 'nullable|string|max:200',
            'landmark' => 'nullable|string|max:200',
            'socialFormat' => 'nullable|string|in:youtube_shorts,tiktok,instagram_reels',
            'mediaUrl' => 'nullable|string|max:2048',
            'mediaType' => 'nullable|in:image,video',
            'videoFrameMode' => 'nullable|in:crop,fit,original',
            'videoPosterUrl' => 'nullable|string|max:2048',
            'caption' => 'nullable|string|max:500',
            'imageText' => 'nullable|string|max:500',
            'bannerText' => 'nullable|string|max:200',
            'stickers' => 'nullable|array',
            'templateId' => 'nullable|string|max:100',
            'mediaItems' => 'nullable|array',
            'mediaItems.*.url' => 'required|string|max:2048',
            'mediaItems.*.type' => 'required|in:image,video,text',
            'mediaItems.*.duration' => 'nullable|numeric|min:0',
            'mediaItems.*.posterUrl' => 'nullable|string|max:2048',
            'textStyle' => 'nullable|array',
            'textStyle.color' => 'nullable|string|max:50',
            'textStyle.size' => 'nullable|in:small,medium,large',
            'textStyle.background' => 'nullable|string|max:200',
            'taggedUsers' => 'nullable|array',
            'taggedUsers.*' => 'required|string|exists:users,handle',
            'videoCaptionsEnabled' => 'nullable|boolean',
            'videoCaptionText' => 'nullable|string|max:1000',
            'subtitlesEnabled' => 'nullable|boolean',
            'subtitleText' => 'nullable|string|max:2000',
            'editTimeline' => 'nullable|array', // Edit timeline for hybrid editing pipeline
            'aiMusicConfig' => 'nullable|array', // AI music configuration
            'musicTrackId' => 'nullable|integer|exists:music,id', // Library music track ID
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        if (!$request->text && !$request->mediaUrl && !$request->mediaItems) {
            return response()->json(['error' => 'Post must have text or media'], 400);
        }

        $mediaUrl = $request->input('mediaUrl');
        if (is_string($mediaUrl) && $mediaUrl !== '' && !preg_match('#^https?://#i', $mediaUrl)) {
            return response()->json([
                'error' => 'Invalid media URL',
                'message' => 'mediaUrl must be an http(s) URL after upload. Local device paths are not allowed.',
            ], 400);
        }
        $videoPosterUrl = $request->input('videoPosterUrl');
        if (is_string($videoPosterUrl) && $videoPosterUrl !== '' && !preg_match('#^https?://#i', $videoPosterUrl)) {
            return response()->json([
                'error' => 'Invalid poster URL',
                'message' => 'videoPosterUrl must be an http(s) URL after upload.',
            ], 400);
        }

        $user = Auth::user();
        if (! $user) {
            \Log::warning('posts.store rejected: unauthenticated');
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        \Log::info('posts.store', [
            'user_id' => $user->id,
            'handle' => $user->handle,
            'has_media' => (bool) ($request->mediaUrl || $request->mediaItems),
            'media_type' => $request->mediaType,
            'location' => $request->location,
        ]);

        $post = DB::transaction(function () use ($request, $user) {
            $geo = $this->resolvePostGeoFields($request);

            $mediaItems = $request->mediaItems;
            $posterUrl = is_string($request->videoPosterUrl) ? trim($request->videoPosterUrl) : '';
            if ((!is_array($mediaItems) || $mediaItems === []) && $request->mediaUrl) {
                $mediaItems = [[
                    'url' => $request->mediaUrl,
                    'type' => $request->mediaType ?: 'image',
                ]];
            }
            if ($posterUrl !== '' && is_array($mediaItems)) {
                foreach ($mediaItems as $index => $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $type = $item['type'] ?? null;
                    if ($type === 'video' || ($index === 0 && $type !== 'image')) {
                        $mediaItems[$index]['posterUrl'] = $item['posterUrl'] ?? $posterUrl;
                        $mediaItems[$index]['poster_url'] = $item['poster_url'] ?? $posterUrl;
                        $mediaItems[$index]['thumbnail_url'] = $item['thumbnail_url'] ?? $posterUrl;
                        $mediaItems[$index]['thumbnailUrl'] = $item['thumbnailUrl'] ?? $posterUrl;
                        break;
                    }
                }
            }

            $post = Post::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
                'media_url' => $request->mediaUrl,
                'media_type' => $request->mediaType,
                'thumbnail_url' => $posterUrl !== '' ? $posterUrl : null,
                'location_label' => $geo['location_label'] ?? $request->location,
                'place_id' => $geo['place_id'],
                'latitude' => $geo['latitude'],
                'longitude' => $geo['longitude'],
                'venue' => $request->venue,
                'landmark' => $request->landmark,
                'social_format' => $request->socialFormat,
                'caption' => $request->caption,
                'image_text' => $request->imageText,
                'banner_text' => $request->bannerText,
                'stickers' => $request->stickers,
                'template_id' => $request->templateId,
                'media_items' => is_array($mediaItems) ? $mediaItems : $request->mediaItems,
                'text_style' => $request->textStyle,
                'video_captions_enabled' => $request->videoCaptionsEnabled ?? false,
                'video_caption_text' => $request->videoCaptionText,
                'subtitles_enabled' => $request->subtitlesEnabled ?? false,
                'subtitle_text' => $request->subtitleText,
                'edit_timeline' => $request->editTimeline,
                'music_track_id' => $request->musicTrackId,
            ]);

            // Attach tagged users if provided
            if ($request->taggedUsers && is_array($request->taggedUsers) && count($request->taggedUsers) > 0) {
                $pivot = User::whereIn('handle', $request->taggedUsers)
                    ->get()
                    ->mapWithKeys(fn ($taggedUser) => [$taggedUser->id => $taggedUser->handle])
                    ->all();

                $post->attachTaggedUsersPivot($pivot);
            }

            // Update user posts count
            $user->increment('posts_count');

            // Create render job if editTimeline is provided (hybrid editing pipeline)
            if ($request->editTimeline && is_array($request->editTimeline) && !empty($request->editTimeline)) {
                $renderJobId = (string) Str::uuid();
                
                // Get video source URL from mediaUrl or first mediaItem
                $videoSourceUrl = $request->mediaUrl;
                if (!$videoSourceUrl && $request->mediaItems && count($request->mediaItems) > 0) {
                    $videoSourceUrl = $request->mediaItems[0]['url'] ?? '';
                }
                
                if ($videoSourceUrl) {
                    RenderJob::create([
                        'id' => $renderJobId,
                        'user_id' => $user->id,
                        'post_id' => $post->id,
                        'status' => 'queued',
                        'edit_timeline' => $request->editTimeline,
                        'ai_music_config' => $request->aiMusicConfig ?? null,
                        'video_source_url' => $videoSourceUrl,
                    ]);

                    // Dispatch job to queue
                    ProcessRenderJob::dispatch($renderJobId);

                    // Store render job ID in post for reference
                    $post->render_job_id = $renderJobId;
                    $post->save();
                }
            }


            // Reload relationships
            $post->load(['user', 'taggedUsers']);

            return $post;
        });

        app(VideoThumbnailService::class)->ensureForPost($post);
        $post->refresh();
        $post->load(['user', 'taggedUsers']);

        \Log::info('posts.store created', [
            'post_id' => $post->id,
            'user_id' => $post->user_id,
            'user_handle' => $post->user_handle,
            'posts_count' => $user->fresh()?->posts_count,
        ]);

        // Transform taggedUsers to array of handles for frontend compatibility
        $postData = $post->toArray();
        $postData['taggedUsers'] = $post->taggedUsers->pluck('handle')->toArray();
        $poster = $post->resolvedThumbnailUrl();
        $postData['thumbnail_url'] = $poster;
        $postData['video_poster_url'] = $poster;
        $postData['poster_url'] = $poster;
        
        // Include render_job_id if a render job was created
        if ($post->render_job_id) {
            $postData['render_job_id'] = $post->render_job_id;
        }

        return response()->json($postData, 201);
    }

    /**
     * Update post (text and location only)
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'text' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:200',
            'placeId' => 'nullable|string|max:255',
            'place_id' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'venue' => 'nullable|string|max:200',
            'landmark' => 'nullable|string|max:200',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($id);

        // Ensure user owns the post
        if ($post->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Update only text, location, venue, and landmark
        if ($request->has('text')) {
            $post->text_content = $request->text;
        }
        if ($request->has('location') || $request->has('placeId') || $request->has('place_id')
            || $request->has('latitude') || $request->has('longitude')) {
            $geo = $this->resolvePostGeoFields($request);
            if ($geo['location_label'] !== null) {
                $post->location_label = $geo['location_label'];
            } elseif ($request->has('location')) {
                $post->location_label = $request->location;
            }
            if ($geo['place_id'] !== null || $request->has('placeId') || $request->has('place_id')) {
                $post->place_id = $geo['place_id'];
            }
            if ($geo['latitude'] !== null || $request->has('latitude')) {
                $post->latitude = $geo['latitude'];
            }
            if ($geo['longitude'] !== null || $request->has('longitude')) {
                $post->longitude = $geo['longitude'];
            }
        }
        if ($request->has('venue')) {
            $post->venue = $request->venue;
        }
        if ($request->has('landmark')) {
            $post->landmark = $request->landmark;
        }

        $post->save();

        // Invalidate feed cache so next GET /posts returns fresh data (including this edit)
        Cache::put('feed_version', (int) Cache::get('feed_version', 0) + 1);

        // Reload relationships
        $post->load(['user', 'taggedUsers']);

        // Transform to frontend format (same as store method)
        $postData = $post->toArray();
        $postData['taggedUsers'] = $post->taggedUsers->pluck('handle')->toArray();
        
        // Map backend fields to frontend format
        $postData['text'] = $postData['text_content'] ?? '';
        $postData['locationLabel'] = $postData['location_label'] ?? '';
        $postData['userHandle'] = $postData['user_handle'] ?? '';
        $postData['createdAt'] = $post->created_at ? strtotime($post->created_at) * 1000 : time() * 1000;
        $postData['stats'] = [
            'likes' => $postData['likes_count'] ?? 0,
            'views' => $postData['views_count'] ?? 0,
            'comments' => $postData['comments_count'] ?? 0,
            'shares' => $postData['shares_count'] ?? 0,
            'reclips' => $postData['reclips_count'] ?? 0,
        ];
        $postData['userLiked'] = $post->isLikedBy($user);
        $postData['isBookmarked'] = $post->isBookmarkedBy($user);
        $postData['isFollowing'] = $post->isFollowingAuthor($user);
        $postData['userReclipped'] = $post->isReclippedBy($user);

        return response()->json($postData);
    }

    /**
     * Delete post. Only the post owner can delete.
     */
    public function destroy(string $id): JsonResponse
    {
        $user = Auth::user();
        $post = Post::find($id);

        if (!$post) {
            return response()->json(['error' => 'Post not found'], 404);
        }

        if ($post->user_id !== $user->id) {
            return response()->json(['error' => 'You can only delete your own posts'], 403);
        }

        $post->delete();
        return response()->json(['success' => true]);
    }

    /**
     * Toggle like on post
     */
    public function toggleLike(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($id);

        $result = DB::transaction(function () use ($user, $post) {
            $existingLike = $user->postLikes()->where('post_id', $post->id)->first();

            if ($existingLike) {
                // Unlike
                $user->postLikes()->detach($post->id);
                $post->decrement('likes_count');
                return ['liked' => false];
            } else {
                // Like
                $user->postLikes()->attach($post->id);
                $post->increment('likes_count');
                BoostAnalyticsService::incrementForPost($post->id, 'likes_count');
                return ['liked' => true];
            }
        });

        if (($result['liked'] ?? false) === true && $post->user_id && $post->user_id !== $user->id) {
            $owner = User::find($post->user_id);
            if ($owner) {
                (new InteractionPushService)->notifyLike($user, $owner, (string) $post->id);
            }
        }

        $post->refresh();
        Post::bumpFeedCache();

        return response()->json([
            'id' => $post->id,
            'liked' => (bool) ($result['liked'] ?? false),
            'user_liked' => (bool) ($result['liked'] ?? false),
            'likes_count' => (int) $post->likes_count,
        ]);
    }

    /**
     * List users who liked a post (for feed "Likes and views" sheet).
     */
    public function listLikes(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(
            ['id' => $id, 'limit' => $request->query('limit')],
            [
                'id' => 'required|uuid|exists:posts,id',
                'limit' => 'nullable|integer|min:1|max:100',
            ]
        );

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $limit = (int) ($request->query('limit', 100));
        $viewerId = $request->query('userId');

        $post = Post::findOrFail($id);

        $query = $post->likes()
            ->select('users.id', 'users.handle', 'users.display_name', 'users.avatar_url')
            ->orderByDesc('post_likes.created_at');

        if (!empty($viewerId)) {
            $query->selectRaw(
                "exists(
                    select 1 from user_follows uf
                    where uf.following_id = users.id
                    and uf.follower_id = ?
                    and uf.status = 'accepted'
                ) as is_following",
                [$viewerId]
            );
        }

        $likers = $query->limit($limit)->get();

        $items = $likers->map(function ($user) use ($viewerId) {
            return [
                'handle' => $user->handle,
                'display_name' => $user->display_name,
                'avatar_url' => $user->avatar_url,
                'is_following' => !empty($viewerId) ? (bool) ($user->is_following ?? false) : false,
            ];
        })->values();

        return response()->json([
            'items' => $items,
            'total' => (int) $post->likes_count,
            'likes_count' => (int) $post->likes_count,
            'views_count' => (int) $post->views_count,
        ]);
    }

    /**
     * Increment view count
     */
    public function incrementView(Request $request, string $id): JsonResponse
    {
        try {
            // Find post by id (can be UUID or string)
            $post = Post::where('id', $id)->first();

            // If post doesn't exist in database, return success anyway (frontend may be using mock data)
            if (!$post) {
                return response()->json([
                    'success' => true,
                    'views' => 0,
                    'message' => 'Post not in database, view tracked client-side'
                ]);
            }

            $user = Auth::user();

            // If user is authenticated, track the view
            if ($user) {
                try {
                    DB::transaction(function () use ($user, $post) {
                        try {
                            if (!$user->views()->where('post_id', $post->id)->exists()) {
                                $user->views()->attach($post->id, [], false);
                            }
                        } catch (\Illuminate\Database\QueryException $e) {
                            if ($e->getCode() !== '23000' && $e->getCode() !== 23000) {
                                throw $e;
                            }
                        } catch (\Exception $e) {
                            \Log::debug('View tracking error: ' . $e->getMessage());
                        }
                    });
                } catch (\Exception $e) {
                    \Log::debug('View tracking transaction error: ' . $e->getMessage());
                }
            }

            try {
                $post->increment('views_count');
                BoostAnalyticsService::incrementForPost($post->id, 'impressions_count');
            } catch (\Exception $e) {
                // no-op
            }

            $views = 0;
            try {
                $views = (int) ($post->fresh()->views_count ?? 0);
            } catch (\Throwable $e) {
                // no-op
            }

            Post::bumpFeedCache();

            return response()->json([
                'success' => true,
                'views' => $views
            ]);
        } catch (\Throwable $e) {
            \Log::warning('incrementView failed: ' . $e->getMessage(), ['id' => $id, 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => true,
                'views' => 0,
                'message' => 'View tracked client-side'
            ]);
        }
    }

    /**
     * Share post
     */
    public function share(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($id);
        if (empty($post->public_share_token)) {
            $post->public_share_token = Str::random(48);
            $post->save();
        }

        DB::transaction(function () use ($user, $post) {
            if ($user instanceof User) {
                $user->shares()->syncWithoutDetaching([$post->id]);
            }
            $post->increment('shares_count');
            BoostAnalyticsService::incrementForPost($post->id, 'shares_count');
        });

        $post->load([self::FEED_USER_WITH, 'taggedUsers:id,handle,display_name,avatar_url']);
        $post->loadCount(Post::engagementWithCounts());
        Post::bumpFeedCache();
        $postData = self::toApiArray($post, $user instanceof User ? $user : null);
        $postData['public_share_url'] = $this->buildPublicShareUrl($post->public_share_token);
        $postData['success'] = true;

        return response()->json($postData);
    }

    /**
     * Regenerate a post's public share token.
     */
    public function regenerateShareToken(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($id);

        if (!$user instanceof User || $post->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $post->public_share_token = Str::random(48);
        $post->save();

        return response()->json([
            'success' => true,
            'public_share_token' => $post->public_share_token,
            'public_share_url' => $this->buildPublicShareUrl($post->public_share_token),
        ]);
    }

    /**
     * Reclip post
     */
    public function reclip(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $originalPost = Post::findOrFail($id);

        // Prevent users from reclipping their own posts
        if ($originalPost->user_handle === $user->handle) {
            return response()->json(['error' => 'Cannot reclip your own post'], 400);
        }

        $result = DB::transaction(function () use ($user, $originalPost) {
            // Check if already reclipped
            $existingReclip = $user->reclips()->where('post_id', $originalPost->id)->first();
            
            if ($existingReclip) {
                // Return the updated original post instead of error
                $originalPost->refresh();
                return $originalPost;
            }

            // Create reclipped post
            $reclippedPost = Post::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $originalPost->text_content,
                'media_url' => $originalPost->media_url,
                'media_type' => $originalPost->media_type,
                'location_label' => $originalPost->location_label,
                'is_reclipped' => true,
                'original_post_id' => $originalPost->id,
                'original_user_handle' => $originalPost->user_handle, // Original poster's handle
                'reclipped_by' => $user->handle,
            ]);

            // Add reclip record
            $user->reclips()->create([
                'post_id' => $originalPost->id,
                'user_handle' => $user->handle
            ]);

            // Update original post reclip count
            $originalPost->increment('reclips_count');
            Post::bumpFeedCache();

            return $reclippedPost;
        });

        // Refresh the post to get all relationships
        $result->load(['user', 'originalPost']);

        return response()->json($result, 201);
    }
}
