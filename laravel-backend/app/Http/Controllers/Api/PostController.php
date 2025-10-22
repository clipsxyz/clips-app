<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PostController extends Controller
{
    /**
     * Get posts with pagination and filtering
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cursor' => 'integer|min:0',
            'limit' => 'integer|min:1|max:50',
            'filter' => 'string|in:Finglas,Dublin,Ireland,Following',
            'userId' => 'uuid|exists:users,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $cursor = $request->get('cursor', 0);
        $limit = $request->get('limit', 10);
        $filter = $request->get('filter', 'Dublin');
        $userId = $request->get('userId');
        $offset = $cursor * $limit;

        $query = Post::notReclipped()
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips']);

        // Add user-specific relationships if userId provided
        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['bookmarks' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['user.followers' => function ($q) use ($userId) {
                $q->where('follower_id', $userId);
            }]);
        }

        // Apply filters
        if ($filter === 'Following' && $userId) {
            $query->following($userId);
        } elseif ($filter !== 'Following') {
            $query->byLocation($filter);
        }

        $posts = $query->orderBy('created_at', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get();

        // Transform posts to include user-specific data
        $transformedPosts = $posts->map(function ($post) use ($userId) {
            $postData = $post->toArray();
            
            if ($userId) {
                $postData['user_liked'] = $post->isLikedBy(User::find($userId));
                $postData['is_bookmarked'] = $post->isBookmarkedBy(User::find($userId));
                $postData['is_following'] = $post->isFollowingAuthor(User::find($userId));
            } else {
                $postData['user_liked'] = false;
                $postData['is_bookmarked'] = false;
                $postData['is_following'] = false;
            }

            return $postData;
        });

        $nextCursor = $posts->count() === $limit ? $cursor + 1 : null;

        return response()->json([
            'items' => $transformedPosts,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
        ]);
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
        
        $query = Post::with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips']);

        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['bookmarks' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['user.followers' => function ($q) use ($userId) {
                $q->where('follower_id', $userId);
            }]);
        }

        $post = $query->findOrFail($id);

        $postData = $post->toArray();
        
        if ($userId) {
            $postData['user_liked'] = $post->isLikedBy(User::find($userId));
            $postData['is_bookmarked'] = $post->isBookmarkedBy(User::find($userId));
            $postData['is_following'] = $post->isFollowingAuthor(User::find($userId));
        } else {
            $postData['user_liked'] = false;
            $postData['is_bookmarked'] = false;
            $postData['is_following'] = false;
        }

        return response()->json($postData);
    }

    /**
     * Create new post
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'text' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:200',
            'mediaUrl' => 'nullable|url',
            'mediaType' => 'nullable|in:image,video'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        if (!$request->text && !$request->mediaUrl) {
            return response()->json(['error' => 'Post must have text or media'], 400);
        }

        $user = Auth::user();

        $post = DB::transaction(function () use ($request, $user) {
            $post = Post::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
                'media_url' => $request->mediaUrl,
                'media_type' => $request->mediaType,
                'location_label' => $request->location,
            ]);

            // Update user posts count
            $user->increment('posts_count');

            return $post;
        });

        return response()->json($post, 201);
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
                return ['liked' => true];
            }
        });

        return response()->json($result);
    }

    /**
     * Increment view count
     */
    public function incrementView(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($id);

        DB::transaction(function () use ($user, $post) {
            // Insert view (will be ignored if duplicate due to unique constraint)
            $user->views()->firstOrCreate(['post_id' => $post->id]);
        });

        return response()->json(['success' => true]);
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

        DB::transaction(function () use ($user, $post) {
            $user->shares()->create(['post_id' => $post->id]);
            $post->increment('shares_count');
        });

        return response()->json(['success' => true]);
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

        $result = DB::transaction(function () use ($user, $originalPost) {
            // Check if already reclipped
            $existingReclip = $user->reclips()->where('post_id', $originalPost->id)->first();
            
            if ($existingReclip) {
                throw new \Exception('Post already reclipped');
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
                'reclipped_by' => $user->handle,
            ]);

            // Add reclip record
            $user->reclips()->create([
                'post_id' => $originalPost->id,
                'user_handle' => $user->handle
            ]);

            // Update original post reclip count
            $originalPost->increment('reclips_count');

            return $reclippedPost;
        });

        return response()->json($result, 201);
    }
}
