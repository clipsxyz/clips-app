<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Notification;
use App\Services\BoostAnalyticsService;
use App\Services\VideoThumbnailService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Check if the given user (by handle) follows the current viewer. Used for mutual-follow DM icon.
     * GET /api/users/check-follows-me?handle=Ava@galway
     */
    public function checkFollowsMe(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'handle' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }
        $handle = $request->query('handle');
        $other = User::whereRaw('LOWER(handle) = ?', [strtolower($handle)])->first();
        $viewer = Auth::user();
        if (!$viewer || !$other) {
            return response()->json(['follows_me' => false]);
        }
        $followsMe = DB::table('user_follows')
            ->where('follower_id', $other->id)
            ->where('following_id', $viewer->id)
            ->where('status', 'accepted')
            ->exists();
        return response()->json(['follows_me' => $followsMe]);
    }

    /**
     * Get user profile + first page of posts.
     * Identifier may be handle (case-insensitive, optional @) or user UUID.
     */
    public function show(Request $request, string $handle): JsonResponse
    {
        $user = $this->resolveProfileUser($handle);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $viewer = Auth::user() ?: $this->resolveViewer($request);
        if (! $this->viewerCanSeeProfile($user, $viewer instanceof User ? $viewer : null)) {
            return response()->json([
                'error' => 'Profile is private',
                'is_private' => true,
                'can_view' => false,
                'requires_follow' => true,
            ], 403);
        }

        $page = $this->paginateProfilePosts($request, $user, $viewer instanceof User ? $viewer : null);

        if ($viewer instanceof User && $viewer->id !== $user->id) {
            $sourcePostId = (string) $request->get('sourcePostId', '');
            BoostAnalyticsService::recordProfileVisitForUser(
                (string) $user->id,
                (string) $viewer->id,
                Str::isUuid($sourcePostId) ? $sourcePostId : null
            );
        }

        $counts = $user->syncLiveAudienceCounts(false);
        $userData = $user->toArray();
        $followersCount = $counts['followers_count'];
        $followingCount = $counts['following_count'];
        $userData['followers_count'] = $followersCount;
        $userData['following_count'] = $followingCount;
        $viewerId = $viewer instanceof User ? $viewer->id : null;
        $userData['is_following'] = $viewerId
            ? DB::table('user_follows')
                ->where('follower_id', $viewerId)
                ->where('following_id', $user->id)
                ->where('status', 'accepted')
                ->exists()
            : false;
        $userData['has_pending_request'] = $viewerId
            ? DB::table('user_follows')
                ->where('follower_id', $viewerId)
                ->where('following_id', $user->id)
                ->where('status', 'pending')
                ->exists()
            : false;
        $userData['posts'] = $page['posts'];
        $userData['postsNextCursor'] = $page['postsNextCursor'];
        $userData['postsHasMore'] = $page['postsHasMore'];
        $userData['posts_count'] = $page['posts_count'];
        $userData['can_view'] = true;
        $userData['likes_count'] = (int) $user->posts()->sum('likes_count');
        $userData['views_count'] = (int) $user->posts()->sum('views_count');
        $userData['stats'] = [
            'likes' => $userData['likes_count'],
            'likes_count' => $userData['likes_count'],
            'views' => $userData['views_count'],
            'views_count' => $userData['views_count'],
            'followers' => $followersCount,
            'following' => $followingCount,
        ];

        return response()->json($userData);
    }

    /**
     * GET /api/users/{id}/posts — profile grid. {id} is handle or user UUID.
     * Query: tab=all|videos|photos|text, postsLimit, postsCursor, userId (viewer).
     */
    public function posts(Request $request, string $handle): JsonResponse
    {
        $user = $this->resolveProfileUser($handle);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $viewer = Auth::user() ?: $this->resolveViewer($request);
        if (! $this->viewerCanSeeProfile($user, $viewer instanceof User ? $viewer : null)) {
            return response()->json([
                'error' => 'Profile is private',
                'is_private' => true,
                'can_view' => false,
                'requires_follow' => true,
            ], 403);
        }

        return response()->json($this->paginateProfilePosts(
            $request,
            $user,
            $viewer instanceof User ? $viewer : null
        ));
    }

    /**
     * Follow / unfollow. Send `{ "following": true|false }` so a retry cannot invert the row.
     * Omitting `following` keeps the legacy toggle for older clients.
     */
    public function toggleFollow(Request $request, string $handle): JsonResponse
    {
        $follower = Auth::user();
        if (!$follower) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $following = $this->resolveProfileUser($handle);
        if (!$following) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if ($follower->id === $following->id) {
            return response()->json(['error' => 'Cannot follow yourself'], 400);
        }

        $payload = $request->isJson() ? $request->json()->all() : $request->all();
        $desired = $this->parseDesiredFollowing($payload['following'] ?? null);

        $result = DB::transaction(function () use ($follower, $following, $desired) {
            $existingFollow = DB::table('user_follows')
                ->where('follower_id', $follower->id)
                ->where('following_id', $following->id)
                ->lockForUpdate()
                ->first();

            if ($desired === true) {
                return $this->ensureFollowing($follower, $following, $existingFollow);
            }
            if ($desired === false) {
                return $this->ensureUnfollowed($follower, $following, $existingFollow);
            }

            if ($existingFollow) {
                return $this->ensureUnfollowed($follower, $following, $existingFollow);
            }

            return $this->ensureFollowing($follower, $following, null);
        });

        return response()->json($result);
    }

    private function parseDesiredFollowing(mixed $value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value === 1;
        }
        if (!is_string($value)) {
            return null;
        }

        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return $parsed;
    }

    /**
     * @param  object|null  $existingFollow
     * @return array{following: bool, status: string, message?: string}
     */
    private function ensureFollowing(User $follower, User $target, $existingFollow): array
    {
        if ($existingFollow) {
            if ($existingFollow->status === 'accepted') {
                return ['following' => true, 'status' => 'accepted'];
            }

            return ['following' => false, 'status' => 'pending', 'message' => 'Follow request sent'];
        }

        if ($target->is_private) {
            DB::table('user_follows')->insert([
                'follower_id' => $follower->id,
                'following_id' => $target->id,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            (new \App\Services\InteractionPushService)->notifyFollowRequest($follower, $target);

            return ['following' => false, 'status' => 'pending', 'message' => 'Follow request sent'];
        }

        DB::table('user_follows')->insert([
            'follower_id' => $follower->id,
            'following_id' => $target->id,
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $follower->increment('following_count');
        $target->increment('followers_count');

        (new \App\Services\InteractionPushService)->notifyFollow($follower, $target);

        return ['following' => true, 'status' => 'accepted'];
    }

    /**
     * @param  object|null  $existingFollow
     * @return array{following: bool, status: string}
     */
    private function ensureUnfollowed(User $follower, User $target, $existingFollow): array
    {
        if (!$existingFollow) {
            return ['following' => false, 'status' => 'unfollowed'];
        }

        DB::table('user_follows')
            ->where('follower_id', $follower->id)
            ->where('following_id', $target->id)
            ->delete();

        if ($existingFollow->status === 'accepted') {
            $follower->decrement('following_count');
            $target->decrement('followers_count');
        }

        return ['following' => false, 'status' => 'unfollowed'];
    }

    /**
     * People who follow this profile. Public for public profiles (same as GET /users/{handle}).
     */
    public function followers(Request $request, string $handle): JsonResponse
    {
        return $this->paginateConnections($request, $handle, 'followers');
    }

    /**
     * People this profile follows. Public for public profiles (same as GET /users/{handle}).
     */
    public function following(Request $request, string $handle): JsonResponse
    {
        return $this->paginateConnections($request, $handle, 'following');
    }

    /**
     * Followers / following totals only. Used by View Profile so counts do not
     * depend on the heavy profile+posts payload.
     */
    public function audience(Request $request, string $handle): JsonResponse
    {
        $user = $this->resolveProfileUser($handle);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $viewer = Auth::user() ?: $this->resolveViewer($request);
        if (! $this->viewerCanSeeProfile($user, $viewer instanceof User ? $viewer : null)) {
            return response()->json([
                'error' => 'Profile is private',
                'is_private' => true,
                'can_view' => false,
            ], 403);
        }

        $counts = $user->syncLiveAudienceCounts(false);
        $viewerId = $viewer instanceof User ? (string) $viewer->id : null;

        return response()->json([
            'handle' => $user->handle,
            'followers_count' => $counts['followers_count'],
            'following_count' => $counts['following_count'],
            'avatar_url' => $user->avatar_url,
            'is_following' => $viewerId
                ? DB::table('user_follows')
                    ->where('follower_id', $viewerId)
                    ->where('following_id', $user->id)
                    ->where('status', 'accepted')
                    ->exists()
                : false,
        ]);
    }

    /**
     * Toggle profile privacy
     */
    public function togglePrivacy(Request $request): JsonResponse
    {
        $user = Auth::user();
        $user->is_private = !$user->is_private;
        $user->save();

        return response()->json([
            'is_private' => $user->is_private,
            'message' => $user->is_private ? 'Profile set to private' : 'Profile set to public'
        ]);
    }

    /**
     * Accept follow request
     */
    public function acceptFollowRequest(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $requester = User::where('handle', $handle)->firstOrFail();

        $result = DB::transaction(function () use ($user, $requester) {
            $followRequest = DB::table('user_follows')
                ->where('follower_id', $requester->id)
                ->where('following_id', $user->id)
                ->where('status', 'pending')
                ->first();

            if (!$followRequest) {
                return ['error' => 'Follow request not found'];
            }

            // Update status to accepted
            DB::table('user_follows')
                ->where('follower_id', $requester->id)
                ->where('following_id', $user->id)
                ->update(['status' => 'accepted', 'updated_at' => now()]);

            // Update counts
            $requester->increment('following_count');
            $user->increment('followers_count');

            // Delete the notification
            Notification::where('user_id', $user->id)
                ->where('type', 'follow_request')
                ->where('from_handle', $requester->handle)
                ->delete();

            return ['status' => 'accepted', 'message' => 'Follow request accepted'];
        });

        if (isset($result['error'])) {
            return response()->json($result, 404);
        }

        return response()->json($result);
    }

    /**
     * Deny follow request
     */
    public function denyFollowRequest(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $requester = User::where('handle', $handle)->firstOrFail();

        $result = DB::transaction(function () use ($user, $requester) {
            $followRequest = DB::table('user_follows')
                ->where('follower_id', $requester->id)
                ->where('following_id', $user->id)
                ->where('status', 'pending')
                ->first();

            if (!$followRequest) {
                return ['error' => 'Follow request not found'];
            }

            // Delete the follow request
            DB::table('user_follows')
                ->where('follower_id', $requester->id)
                ->where('following_id', $user->id)
                ->delete();

            // Delete the notification
            Notification::where('user_id', $user->id)
                ->where('type', 'follow_request')
                ->where('from_handle', $requester->handle)
                ->delete();

            return ['status' => 'denied', 'message' => 'Follow request denied'];
        });

        if (isset($result['error'])) {
            return response()->json($result, 404);
        }

        return response()->json($result);
    }

    /**
     * @param  'followers'|'following'  $relation
     */
    private function paginateConnections(Request $request, string $handle, string $relation): JsonResponse
    {
        $user = $this->resolveProfileUser($handle);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $viewer = Auth::user() ?: $this->resolveViewer($request);
        if (! $this->viewerCanSeeProfile($user, $viewer instanceof User ? $viewer : null)) {
            return response()->json([
                'error' => 'Profile is private',
                'is_private' => true,
                'can_view' => false,
            ], 403);
        }

        $cursorState = $this->decodeConnectionsCursor((string) $request->get('cursor', ''));
        $limit = max(1, min((int) $request->get('limit', 20), 200));

        $query = $user->{$relation}()
            ->select('users.id', 'users.display_name', 'users.handle', 'users.avatar_url', 'users.bio', 'user_follows.created_at as followed_at')
            ->orderBy('user_follows.created_at', 'desc')
            ->orderBy('users.id', 'desc');

        if ($cursorState['created_at'] && $cursorState['id']) {
            $query->where(function ($q) use ($cursorState) {
                $q->where('user_follows.created_at', '<', $cursorState['created_at'])
                    ->orWhere(function ($q2) use ($cursorState) {
                        $q2->where('user_follows.created_at', '=', $cursorState['created_at'])
                            ->where('users.id', '<', $cursorState['id']);
                    });
            });
        }

        $rows = $query->limit($limit)->get();
        $last = $rows->last();
        $nextCursor = null;
        if ($rows->count() === $limit && $last) {
            $nextCursor = $this->encodeConnectionsCursor((string) $last->followed_at, (string) $last->id);
        }

        return response()->json([
            'items' => $rows->map(fn (User $person) => $this->connectionItem($person))->values(),
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null,
            'total' => $user->{$relation}()->count(),
        ]);
    }

    /**
     * @return array{id: string, handle: string, display_name: ?string, avatar_url: ?string, bio: ?string}
     */
    private function connectionItem(User $person): array
    {
        return [
            'id' => (string) $person->id,
            'handle' => (string) $person->handle,
            'display_name' => $person->display_name,
            'avatar_url' => $person->avatar_url,
            'bio' => $person->bio,
        ];
    }

    /**
     * Resolve profile owner by UUID or handle (case-insensitive, optional leading @).
     */
    private function decodeRouteIdentifier(string $identifier): string
    {
        $raw = trim($identifier);
        for ($i = 0; $i < 2; $i++) {
            $decoded = rawurldecode($raw);
            if ($decoded === $raw) {
                break;
            }
            $raw = $decoded;
        }

        return trim($raw);
    }

    private function resolveProfileUser(string $identifier): ?User
    {
        $raw = $this->decodeRouteIdentifier($identifier);
        if ($raw === '') {
            return null;
        }

        if (Str::isUuid($raw)) {
            $byId = User::find($raw);
            if ($byId) {
                return $byId;
            }
        }

        $withoutAt = ltrim($raw, '@');
        $withAt = '@' . $withoutAt;
        $candidates = array_values(array_unique(array_filter([$raw, $withoutAt, $withAt])));

        foreach ($candidates as $handle) {
            $user = User::whereRaw('LOWER(handle) = ?', [mb_strtolower($handle)])->first();
            if ($user) {
                return $user;
            }
        }

        $byUsername = User::whereRaw('LOWER(username) = ?', [mb_strtolower($withoutAt)])->first();
        if ($byUsername) {
            return $byUsername;
        }

        if (!str_contains($withoutAt, '@')) {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($withoutAt));
            $matches = User::query()
                ->whereRaw('LOWER(handle) LIKE ? ESCAPE \'\\\'', [$escaped.'@%'])
                ->limit(2)
                ->get();
            if ($matches->count() === 1) {
                return $matches->first();
            }
        }

        return null;
    }

    private function viewerCanSeeProfile(User $profile, ?User $viewer): bool
    {
        if (! $profile->is_private) {
            return true;
        }

        return $viewer instanceof User && $profile->canViewProfile($viewer);
    }

    private function resolveViewer(Request $request): ?User
    {
        $viewer = Auth::user() ?: Auth::guard('sanctum')->user();
        if ($viewer instanceof User) {
            return $viewer;
        }
        $userId = (string) $request->get('userId', '');
        if ($userId !== '' && Str::isUuid($userId)) {
            return User::find($userId);
        }
        return null;
    }

    /**
     * Indexed user_id query + eager-loaded author. Media lives on the post row (media_url / media_items).
     *
     * @return array{posts: \Illuminate\Support\Collection, postsNextCursor: ?string, postsHasMore: bool, posts_count: int, likes_count: int, views_count: int, stats: array{likes: int, views: int, followers: int, following: int}}
     */
    private function paginateProfilePosts(Request $request, User $user, ?User $viewer): array
    {
        $postsLimit = max(1, min((int) $request->get('postsLimit', 20), 50));
        $postsCursor = $this->decodePostsCursor((string) $request->get('postsCursor', ''));
        $tab = strtolower(trim((string) $request->get('tab', 'all')));
        if (!in_array($tab, ['all', 'videos', 'photos', 'text'], true)) {
            $tab = 'all';
        }

        $query = \App\Models\Post::query()
            ->where('posts.user_id', $user->id)
            ->notReclipped()
            ->with([
                'user:id,handle,display_name,username,avatar_url,location_local,location_regional,location_national',
            ])
            ->withCount(\App\Models\Post::engagementWithCounts())
            ->select([
                'posts.id',
                'posts.user_id',
                'posts.user_handle',
                'posts.text_content',
                'posts.media_url',
                'posts.media_type',
                'posts.thumbnail_url',
                'posts.location_label',
                'posts.venue',
                'posts.landmark',
                'posts.social_format',
                'posts.tags',
                'posts.likes_count',
                'posts.views_count',
                'posts.comments_count',
                'posts.shares_count',
                'posts.reclips_count',
                'posts.saves_count',
                'posts.is_reclipped',
                'posts.original_post_id',
                'posts.original_user_handle',
                'posts.reclipped_by',
                'posts.banner_text',
                'posts.stickers',
                'posts.template_id',
                'posts.media_items',
                'posts.caption',
                'posts.link_preview',
                'posts.image_text',
                'posts.text_style',
                'posts.video_captions_enabled',
                'posts.video_caption_text',
                'posts.subtitles_enabled',
                'posts.subtitle_text',
                'posts.created_at',
                'posts.updated_at',
            ])
            ->orderBy('posts.created_at', 'desc')
            ->orderBy('posts.id', 'desc');

        $this->applyProfilePostsTab($query, $tab);

        if ($postsCursor['created_at'] && $postsCursor['id']) {
            $query->where(function ($q) use ($postsCursor) {
                $q->where('posts.created_at', '<', $postsCursor['created_at'])
                    ->orWhere(function ($q2) use ($postsCursor) {
                        $q2->where('posts.created_at', '=', $postsCursor['created_at'])
                            ->where('posts.id', '<', $postsCursor['id']);
                    });
            });
        }

        $viewerId = $viewer?->id;
        if ($viewerId) {
            $query->withExists([
                'likes as user_liked' => function ($q) use ($viewerId) {
                    $q->where('users.id', $viewerId);
                },
                'bookmarks as is_bookmarked' => function ($q) use ($viewerId) {
                    $q->where('users.id', $viewerId);
                },
                'reclips as user_reclipped' => function ($q) use ($viewerId) {
                    $q->where('users.id', $viewerId);
                },
            ]);
        }

        $posts = $query->limit($postsLimit + 1)->get();
        $thumbService = app(VideoThumbnailService::class);
        $generated = 0;
        foreach ($posts as $post) {
            if ($generated >= 8) {
                break;
            }
            if ($post->resolvedThumbnailUrl()) {
                continue;
            }
            if ($post->media_type !== 'video') {
                continue;
            }
            if ($thumbService->ensureForPost($post)) {
                $generated++;
            }
        }

        $postsHasMore = $posts->count() > $postsLimit;
        if ($postsHasMore) {
            $posts = $posts->take($postsLimit)->values();
        }
        $lastPost = $posts->last();
        $postsNextCursor = null;
        if ($postsHasMore && $lastPost) {
            $postsNextCursor = $this->encodePostsCursor(
                $lastPost->created_at->format('Y-m-d H:i:s'),
                (string) $lastPost->id
            );
        }

        $transformedPosts = $posts->map(function ($post) use ($viewer, $user) {
            $postData = $post->toArray();
            $attrs = $post->getAttributes();
            $author = $post->user;

            $postData['user_handle'] = $postData['user_handle']
                ?: ($author?->handle ?? $user->handle);
            $postData['user'] = $author ? [
                'id' => $author->id,
                'handle' => $author->handle,
                'display_name' => $author->display_name,
                'avatar_url' => $author->avatar_url,
                'local' => $author->location_local,
                'regional' => $author->location_regional,
                'national' => $author->location_national,
            ] : [
                'id' => $user->id,
                'handle' => $user->handle,
                'display_name' => $user->display_name,
                'avatar_url' => $user->avatar_url,
                'local' => $user->location_local,
                'regional' => $user->location_regional,
                'national' => $user->location_national,
            ];
            $postData['user_liked'] = $viewer
                ? (array_key_exists('user_liked', $attrs) ? (bool) $attrs['user_liked'] : false)
                : false;
            $postData['is_bookmarked'] = $viewer
                ? (array_key_exists('is_bookmarked', $attrs) ? (bool) $attrs['is_bookmarked'] : false)
                : false;
            $postData['user_reclipped'] = $viewer
                ? (array_key_exists('user_reclipped', $attrs) ? (bool) $attrs['user_reclipped'] : false)
                : false;

            $postData = \App\Models\Post::applyEngagementCounts($postData, $attrs);

            $poster = $post->resolvedThumbnailUrl();
            $postData['thumbnail_url'] = $poster;
            $postData['video_poster_url'] = $poster;
            $postData['poster_url'] = $poster;

            return $postData;
        });

        $likesTotal = (int) $user->posts()->sum('likes_count');
        $viewsTotal = (int) $user->posts()->sum('views_count');

        return [
            'posts' => $transformedPosts,
            'postsNextCursor' => $postsNextCursor,
            'postsHasMore' => $postsHasMore,
            'posts_count' => (int) \App\Models\Post::query()
                ->where('user_id', $user->id)
                ->notReclipped()
                ->count(),
            'likes_count' => $likesTotal,
            'views_count' => $viewsTotal,
            'stats' => [
                'likes' => $likesTotal,
                'likes_count' => $likesTotal,
                'views' => $viewsTotal,
                'views_count' => $viewsTotal,
                'followers' => (int) $user->followers()->count(),
                'following' => (int) $user->following()->count(),
            ],
        ];
    }

    private function applyProfilePostsTab($query, string $tab): void
    {
        if ($tab === 'videos') {
            $query->where(function ($q) {
                $q->where('posts.media_type', 'video')
                    ->orWhere('posts.media_items', 'like', '%"type":"video"%');
            });
            return;
        }
        if ($tab === 'photos') {
            $query->where(function ($q) {
                $q->where('posts.media_type', 'image')
                    ->orWhere('posts.media_items', 'like', '%"type":"image"%');
            });
            return;
        }
        if ($tab === 'text') {
            $query->where(function ($q) {
                $q->where(function ($inner) {
                    $inner->whereNull('posts.media_type')->orWhere('posts.media_type', '');
                })->where(function ($inner) {
                    $inner->whereNull('posts.media_url')->orWhere('posts.media_url', '');
                });
            });
        }
    }

    private function decodeConnectionsCursor(?string $cursor): array
    {
        $cursorValue = trim((string) ($cursor ?? ''));
        if ($cursorValue === '' || $cursorValue === '0') {
            return ['created_at' => null, 'id' => null];
        }

        if (ctype_digit($cursorValue)) {
            // Legacy numeric cursor support.
            return ['created_at' => null, 'id' => null];
        }

        $encoded = strtr($cursorValue, '-_', '+/');
        $padding = strlen($encoded) % 4;
        if ($padding > 0) {
            $encoded .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($encoded, true);
        if ($decoded === false || !str_contains($decoded, '|')) {
            return ['created_at' => null, 'id' => null];
        }

        [$createdAt, $id] = explode('|', $decoded, 2);
        if (!$createdAt || !$id || !Str::isUuid($id)) {
            return ['created_at' => null, 'id' => null];
        }

        return ['created_at' => $createdAt, 'id' => $id];
    }

    private function encodeConnectionsCursor(string $createdAt, string $id): string
    {
        return rtrim(strtr(base64_encode($createdAt . '|' . $id), '+/', '-_'), '=');
    }

    private function decodePostsCursor(?string $cursor): array
    {
        $cursorValue = trim((string) ($cursor ?? ''));
        if ($cursorValue === '' || $cursorValue === '0') {
            return ['created_at' => null, 'id' => null];
        }

        if (ctype_digit($cursorValue)) {
            // Legacy numeric cursor support.
            return ['created_at' => null, 'id' => null];
        }

        $encoded = strtr($cursorValue, '-_', '+/');
        $padding = strlen($encoded) % 4;
        if ($padding > 0) {
            $encoded .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($encoded, true);
        if ($decoded === false || !str_contains($decoded, '|')) {
            return ['created_at' => null, 'id' => null];
        }

        [$createdAt, $id] = explode('|', $decoded, 2);
        if (!$createdAt || !$id || !Str::isUuid($id)) {
            return ['created_at' => null, 'id' => null];
        }

        return ['created_at' => $createdAt, 'id' => $id];
    }

    private function encodePostsCursor(string $createdAt, string $id): string
    {
        return rtrim(strtr(base64_encode($createdAt . '|' . $id), '+/', '-_'), '=');
    }
}
