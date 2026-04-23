<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Notification;
use App\Services\BoostAnalyticsService;
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
     * Get user profile
     */
    public function show(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['handle' => $handle]), [
            'handle' => 'required|string|exists:users,handle',
            'postsCursor' => 'nullable|string',
            'postsLimit' => 'nullable|integer|min:1|max:50',
            'sourcePostId' => 'nullable|uuid|exists:posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $userId = $request->get('userId');
        $hasViewer = !empty($userId);
        $user = User::where('handle', $handle)->firstOrFail();
        $postsLimit = (int) $request->get('postsLimit', 20);
        $postsLimit = max(1, min($postsLimit, 50));
        $postsCursor = $this->decodePostsCursor((string) $request->get('postsCursor', ''));

        $query = $user->posts()
            ->notReclipped()
            ->select([
                'posts.id',
                'posts.user_id',
                'posts.user_handle',
                'posts.text_content',
                'posts.media_url',
                'posts.media_type',
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
                'posts.is_reclipped',
                'posts.original_post_id',
                'posts.original_user_handle',
                'posts.reclipped_by',
                'posts.banner_text',
                'posts.stickers',
                'posts.template_id',
                'posts.media_items',
                'posts.caption',
                'posts.image_text',
                'posts.text_style',
                'posts.video_captions_enabled',
                'posts.video_caption_text',
                'posts.subtitles_enabled',
                'posts.subtitle_text',
                'posts.created_at',
                'posts.updated_at',
            ])
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips'])
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($postsCursor['created_at'] && $postsCursor['id']) {
            $query->where(function ($q) use ($postsCursor) {
                $q->where('posts.created_at', '<', $postsCursor['created_at'])
                    ->orWhere(function ($q2) use ($postsCursor) {
                        $q2->where('posts.created_at', '=', $postsCursor['created_at'])
                            ->where('posts.id', '<', $postsCursor['id']);
                    });
            });
        }

        if ($hasViewer) {
            $query->withExists([
                'likes as user_liked' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
                'bookmarks as is_bookmarked' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
                'reclips as user_reclipped' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ]);
        }

        $posts = $query->limit($postsLimit + 1)->get();
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
        $viewer = $hasViewer ? User::find($userId) : null;

        if ($viewer && $viewer->id !== $user->id) {
            BoostAnalyticsService::recordProfileVisitForUser(
                (string) $user->id,
                (string) $viewer->id,
                $request->get('sourcePostId')
            );
        }

        // Transform posts using precomputed exists flags when available.
        $transformedPosts = $posts->map(function ($post) use ($viewer) {
            $postData = $post->toArray();
            $attrs = $post->getAttributes();

            $postData['user_liked'] = $viewer
                ? (array_key_exists('user_liked', $attrs) ? (bool) $attrs['user_liked'] : false)
                : false;
            $postData['is_bookmarked'] = $viewer
                ? (array_key_exists('is_bookmarked', $attrs) ? (bool) $attrs['is_bookmarked'] : false)
                : false;
            $postData['user_reclipped'] = $viewer
                ? (array_key_exists('user_reclipped', $attrs) ? (bool) $attrs['user_reclipped'] : false)
                : false;

            return $postData;
        });
        
        // Check if viewer can access this profile
        $canView = $viewer ? $user->canViewProfile($viewer) : true;
        
        if (!$canView) {
            return response()->json([
                'error' => 'Profile is private',
                'is_private' => true,
                'can_view' => false,
                'requires_follow' => true
            ], 403);
        }

        $userData = $user->toArray();
        $viewerId = $viewer?->id;
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
        $userData['posts'] = $transformedPosts;
        $userData['postsNextCursor'] = $postsNextCursor;
        $userData['postsHasMore'] = $postsHasMore;
        $userData['can_view'] = true;

        return response()->json($userData);
    }

    /**
     * Follow/Unfollow user
     * Handle is resolved case-insensitively so "bob@cork" and "Bob@Cork" both work.
     */
    public function toggleFollow(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $follower = Auth::user();
        $following = User::whereRaw('LOWER(handle) = ?', [strtolower($handle)])->first();

        if (!$following) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if ($follower->id === $following->id) {
            return response()->json(['error' => 'Cannot follow yourself'], 400);
        }

        $result = DB::transaction(function () use ($follower, $following) {
            // Check if there's an existing follow relationship (accepted or pending)
            $existingFollow = DB::table('user_follows')
                ->where('follower_id', $follower->id)
                ->where('following_id', $following->id)
                ->first();

            if ($existingFollow) {
                // Unfollow (remove regardless of status)
                DB::table('user_follows')
                    ->where('follower_id', $follower->id)
                    ->where('following_id', $following->id)
                    ->delete();
                
                // Only decrement counts if it was accepted
                if ($existingFollow->status === 'accepted') {
                    $follower->decrement('following_count');
                    $following->decrement('followers_count');
                }
                
                return ['following' => false, 'status' => 'unfollowed'];
            } else {
                // Check if profile is private
                if ($following->is_private) {
                    // Create pending follow request
                    DB::table('user_follows')->insert([
                        'follower_id' => $follower->id,
                        'following_id' => $following->id,
                        'status' => 'pending',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    // Create notification for the user being followed
                    Notification::create([
                        'user_id' => $following->id,
                        'type' => 'follow_request',
                        'from_handle' => $follower->handle,
                        'to_handle' => $following->handle,
                        'message' => "{$follower->handle} wants to follow you",
                        'read' => false,
                    ]);

                    return ['following' => false, 'status' => 'pending', 'message' => 'Follow request sent'];
                } else {
                    // Public profile - follow immediately
                    DB::table('user_follows')->insert([
                        'follower_id' => $follower->id,
                        'following_id' => $following->id,
                        'status' => 'accepted',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    
                    $follower->increment('following_count');
                    $following->increment('followers_count');
                    
                    return ['following' => true, 'status' => 'accepted'];
                }
            }
        });

        return response()->json($result);
    }

    /**
     * Get user's followers
     */
    public function followers(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = User::where('handle', $handle)->firstOrFail();
        $cursorState = $this->decodeConnectionsCursor((string) $request->get('cursor', ''));
        $limit = (int) $request->get('limit', 20);

        $query = $user->followers()
            ->select('users.id', 'users.username', 'users.display_name', 'users.handle', 'users.avatar_url', 'users.bio', 'user_follows.created_at as followed_at')
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

        $followers = $query->limit($limit)->get();

        $last = $followers->last();
        $nextCursor = null;
        if ($followers->count() === $limit && $last) {
            $nextCursor = $this->encodeConnectionsCursor((string) $last->followed_at, (string) $last->id);
        }

        return response()->json([
            'items' => $followers,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
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
     * Get user's following
     */
    public function following(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = User::where('handle', $handle)->firstOrFail();
        $cursorState = $this->decodeConnectionsCursor((string) $request->get('cursor', ''));
        $limit = (int) $request->get('limit', 20);

        $query = $user->following()
            ->select('users.id', 'users.username', 'users.display_name', 'users.handle', 'users.avatar_url', 'users.bio', 'user_follows.created_at as followed_at')
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

        $following = $query->limit($limit)->get();

        $last = $following->last();
        $nextCursor = null;
        if ($following->count() === $limit && $last) {
            $nextCursor = $this->encodeConnectionsCursor((string) $last->followed_at, (string) $last->id);
        }

        return response()->json([
            'items' => $following,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
        ]);
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
