<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    /**
     * Get user profile
     */
    public function show(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $userId = $request->get('userId');
        $user = User::where('handle', $handle)->firstOrFail();

        $query = $user->posts()
            ->notReclipped()
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips'])
            ->orderBy('created_at', 'desc')
            ->limit(20);

        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['bookmarks' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['reclips' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }]);
        }

        $posts = $query->get();
        $userModel = $userId ? User::find($userId) : null;

        // Transform posts to include user-specific data
        $transformedPosts = $posts->map(function ($post) use ($userModel) {
            $postData = $post->toArray();
            
            if ($userModel) {
                $postData['user_liked'] = $post->isLikedBy($userModel);
                $postData['is_bookmarked'] = $post->isBookmarkedBy($userModel);
                $postData['user_reclipped'] = $post->isReclippedBy($userModel);
            } else {
                $postData['user_liked'] = false;
                $postData['is_bookmarked'] = false;
                $postData['user_reclipped'] = false;
            }

            return $postData;
        });

        $viewer = $userId ? User::find($userId) : null;
        
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
        $userData['is_following'] = $userId ? $user->followers()->where('follower_id', $userId)->exists() : false;
        $userData['has_pending_request'] = $userId ? $viewer->hasPendingFollowRequest($user) : false;
        $userData['posts'] = $transformedPosts;
        $userData['can_view'] = true;

        return response()->json($userData);
    }

    /**
     * Follow/Unfollow user
     */
    public function toggleFollow(Request $request, string $handle): JsonResponse
    {
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $follower = Auth::user();
        $following = User::where('handle', $handle)->firstOrFail();

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
        $cursor = $request->get('cursor', 0);
        $limit = $request->get('limit', 20);
        $offset = $cursor * $limit;

        $followers = $user->followers()
            ->select('users.id', 'users.username', 'users.display_name', 'users.handle', 'users.avatar_url', 'users.bio', 'user_follows.created_at as followed_at')
            ->orderBy('user_follows.created_at', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $nextCursor = $followers->count() === $limit ? $cursor + 1 : null;

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
        $cursor = $request->get('cursor', 0);
        $limit = $request->get('limit', 20);
        $offset = $cursor * $limit;

        $following = $user->following()
            ->select('users.id', 'users.username', 'users.display_name', 'users.handle', 'users.avatar_url', 'users.bio', 'user_follows.created_at as followed_at')
            ->orderBy('user_follows.created_at', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $nextCursor = $following->count() === $limit ? $cursor + 1 : null;

        return response()->json([
            'items' => $following,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
        ]);
    }
}
