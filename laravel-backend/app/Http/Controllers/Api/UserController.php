<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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
            }]);
        }

        $posts = $query->get();

        // Transform posts to include user-specific data
        $transformedPosts = $posts->map(function ($post) use ($userId) {
            $postData = $post->toArray();
            
            if ($userId) {
                $postData['user_liked'] = $post->isLikedBy(User::find($userId));
                $postData['is_bookmarked'] = $post->isBookmarkedBy(User::find($userId));
            } else {
                $postData['user_liked'] = false;
                $postData['is_bookmarked'] = false;
            }

            return $postData;
        });

        $userData = $user->toArray();
        $userData['is_following'] = $userId ? $user->followers()->where('follower_id', $userId)->exists() : false;
        $userData['posts'] = $transformedPosts;

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
            $existingFollow = $follower->following()->where('following_id', $following->id)->first();

            if ($existingFollow) {
                // Unfollow
                $follower->following()->detach($following->id);
                $follower->decrement('following_count');
                $following->decrement('followers_count');
                return ['following' => false];
            } else {
                // Follow
                $follower->following()->attach($following->id);
                $follower->increment('following_count');
                $following->increment('followers_count');
                return ['following' => true];
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
