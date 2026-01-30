<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Models\RenderJob;
use App\Jobs\ProcessRenderJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Support\Str;

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
            'userId' => 'nullable|uuid|exists:users,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $cursor = $request->get('cursor', 0);
        $limit = $request->get('limit', 10);
        $filter = $request->get('filter', 'Dublin');
        // Viewer: query param first, then Auth (protected routes), then Bearer token (public feed on mobile)
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
        $offset = $cursor * $limit;

        $query = Post::notReclipped()
            ->with(['user:id,handle,display_name,avatar_url', 'taggedUsers:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips']);

        // Add user-specific relationships if userId provided
        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['bookmarks' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['reclips' => function ($q) use ($userId) {
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
            ->get()
            ->unique('id')
            ->values();

        // Transform posts to include user-specific data
        $userModel = $userId ? User::find($userId) : null;
        $transformedPosts = $posts->map(function ($post) use ($userModel) {
            $postData = $post->toArray();
            
            // Transform taggedUsers relationship to array of handles for frontend compatibility
            $postData['taggedUsers'] = $post->taggedUsers->pluck('handle')->toArray();
            
            if ($userModel) {
                $postData['user_liked'] = $post->isLikedBy($userModel);
                $postData['is_bookmarked'] = $post->isBookmarkedBy($userModel);
                $postData['is_following'] = $post->isFollowingAuthor($userModel);
                $postData['author_follows_you'] = $post->authorFollowsViewer($userModel);
                $postData['user_reclipped'] = $post->isReclippedBy($userModel);
            } else {
                $postData['user_liked'] = false;
                $postData['is_bookmarked'] = false;
                $postData['is_following'] = false;
                $postData['author_follows_you'] = false;
                $postData['user_reclipped'] = false;
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
        
        $query = Post::with(['user:id,handle,display_name,avatar_url', 'taggedUsers:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'comments', 'shares', 'views', 'reclips']);

        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['bookmarks' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['reclips' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['user.followers' => function ($q) use ($userId) {
                $q->where('follower_id', $userId);
            }]);
        }

        $post = $query->findOrFail($id);
        $userModel = $userId ? User::find($userId) : null;

        $postData = $post->toArray();
        
        // Transform taggedUsers relationship to array of handles for frontend compatibility
        $postData['taggedUsers'] = $post->taggedUsers->pluck('handle')->toArray();
        
        if ($userModel) {
            $postData['user_liked'] = $post->isLikedBy($userModel);
            $postData['is_bookmarked'] = $post->isBookmarkedBy($userModel);
            $postData['is_following'] = $post->isFollowingAuthor($userModel);
            $postData['author_follows_you'] = $post->authorFollowsViewer($userModel);
            $postData['user_reclipped'] = $post->isReclippedBy($userModel);
        } else {
            $postData['user_liked'] = false;
            $postData['is_bookmarked'] = false;
            $postData['is_following'] = false;
            $postData['author_follows_you'] = false;
            $postData['user_reclipped'] = false;
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
            'mediaType' => 'nullable|in:image,video',
            'caption' => 'nullable|string|max:500',
            'imageText' => 'nullable|string|max:500',
            'bannerText' => 'nullable|string|max:200',
            'stickers' => 'nullable|array',
            'templateId' => 'nullable|string|max:100',
            'mediaItems' => 'nullable|array',
            'mediaItems.*.url' => 'required|url',
            'mediaItems.*.type' => 'required|in:image,video',
            'mediaItems.*.duration' => 'nullable|numeric|min:0',
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

        $user = Auth::user();

        $post = DB::transaction(function () use ($request, $user) {
            $post = Post::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
                'media_url' => $request->mediaUrl,
                'media_type' => $request->mediaType,
                'location_label' => $request->location,
                'caption' => $request->caption,
                'image_text' => $request->imageText,
                'banner_text' => $request->bannerText,
                'stickers' => $request->stickers,
                'template_id' => $request->templateId,
                'media_items' => $request->mediaItems,
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
                $taggedUserIds = User::whereIn('handle', $request->taggedUsers)
                    ->get()
                    ->mapWithKeys(function ($taggedUser) {
                        return [$taggedUser->id => ['user_handle' => $taggedUser->handle]];
                    })
                    ->toArray();
                
                $post->taggedUsers()->attach($taggedUserIds);
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

        // Transform taggedUsers to array of handles for frontend compatibility
        $postData = $post->toArray();
        $postData['taggedUsers'] = $post->taggedUsers->pluck('handle')->toArray();
        
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

        // Update only text and location
        if ($request->has('text')) {
            $post->text_content = $request->text;
        }
        if ($request->has('location')) {
            $post->location_label = $request->location;
        }

        $post->save();

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
                    // Insert view (will be ignored if duplicate due to unique constraint)
                    try {
                        // Use attach with duplicate check - attach will ignore if already exists
                        if (!$user->views()->where('post_id', $post->id)->exists()) {
                            $user->views()->attach($post->id, [], false); // false = don't touch timestamps
                        }
                    } catch (\Illuminate\Database\QueryException $e) {
                        // Ignore duplicate entry errors (unique constraint violation)
                        if ($e->getCode() !== '23000') {
                            throw $e; // Re-throw if it's not a duplicate key error
                        }
                    } catch (\Exception $e) {
                        // Ignore other errors in view tracking
                        \Log::debug('View tracking error: ' . $e->getMessage());
                    }
                });
            } catch (\Exception $e) {
                // Ignore any errors in view tracking - don't fail the request
                \Log::debug('View tracking transaction error: ' . $e->getMessage());
            }
        }
        
        // Increment view count regardless of auth status
        try {
            $post->increment('views_count');
        } catch (\Exception $e) {
            // If increment fails, just return current count
        }

        return response()->json([
            'success' => true,
            'views' => $post->fresh()->views_count ?? 0
        ]);
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

            return $reclippedPost;
        });

        // Refresh the post to get all relationships
        $result->load(['user', 'originalPost']);

        return response()->json($result, 201);
    }
}
