<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CollectionController extends Controller
{
    /**
     * Get all collections for authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $collections = Collection::where('user_id', $user->id)
            ->withCount('posts')
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($collection) {
                // Update thumbnail from first post if needed
                if (!$collection->thumbnail_url && $collection->posts_count > 0) {
                    $firstPost = $collection->posts()->first();
                    if ($firstPost && $firstPost->media_url) {
                        $collection->thumbnail_url = $firstPost->media_url;
                        $collection->save();
                    }
                }
                
                return [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
                    'isPrivate' => $collection->is_private,
                    'thumbnailUrl' => $collection->thumbnail_url,
                    'postIds' => $collection->posts()->pluck('posts.id')->toArray(),
                    'createdAt' => $collection->created_at->timestamp * 1000, // Epoch in milliseconds
                    'updatedAt' => $collection->updated_at->timestamp * 1000,
                ];
            });

        return response()->json($collections);
    }

    /**
     * Create a new collection
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'is_private' => 'boolean',
            'post_id' => 'nullable|uuid|exists:posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();

        DB::beginTransaction();
        try {
            $collection = Collection::create([
                'user_id' => $user->id,
                'name' => $request->name,
                'is_private' => $request->boolean('is_private', true),
            ]);

            // If post_id is provided, add it to the collection
            if ($request->has('post_id')) {
                $post = Post::findOrFail($request->post_id);
                $collection->posts()->attach($post->id);
                
                // Set thumbnail from post if it has media
                if ($post->media_url) {
                    $collection->thumbnail_url = $post->media_url;
                    $collection->save();
                }
            }

            DB::commit();

            return response()->json([
                'id' => (string) $collection->id,
                'userId' => $collection->user_id,
                'name' => $collection->name,
                'isPrivate' => $collection->is_private,
                'thumbnailUrl' => $collection->thumbnail_url,
                'postIds' => $collection->posts()->pluck('posts.id')->toArray(),
                'createdAt' => $collection->created_at->timestamp * 1000,
                'updatedAt' => $collection->updated_at->timestamp * 1000,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to create collection'], 500);
        }
    }

    /**
     * Get a specific collection with its posts
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|integer|exists:collections,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->with(['posts' => function ($query) {
                $query->orderBy('collection_posts.created_at', 'desc');
            }])
            ->firstOrFail();

        return response()->json([
            'id' => (string) $collection->id,
            'userId' => $collection->user_id,
            'name' => $collection->name,
            'isPrivate' => $collection->is_private,
            'thumbnailUrl' => $collection->thumbnail_url,
            'postIds' => $collection->posts->pluck('id')->toArray(),
            'posts' => $collection->posts->map(function ($post) {
                return [
                    'id' => $post->id,
                    'userHandle' => $post->user_handle,
                    'text' => $post->text_content,
                    'mediaUrl' => $post->media_url,
                    'mediaType' => $post->media_type,
                    'locationLabel' => $post->location_label,
                    'tags' => $post->tags ?? [],
                    'createdAt' => $post->created_at->timestamp * 1000,
                ];
            }),
            'createdAt' => $collection->created_at->timestamp * 1000,
            'updatedAt' => $collection->updated_at->timestamp * 1000,
        ]);
    }

    /**
     * Update a collection
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['id' => $id]), [
            'id' => 'required|integer|exists:collections,id',
            'name' => 'sometimes|string|max:255',
            'is_private' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($request->has('name')) {
            $collection->name = $request->name;
        }

        if ($request->has('is_private')) {
            $collection->is_private = $request->boolean('is_private');
        }

        $collection->save();

        return response()->json([
            'id' => (string) $collection->id,
            'userId' => $collection->user_id,
            'name' => $collection->name,
            'isPrivate' => $collection->is_private,
            'thumbnailUrl' => $collection->thumbnail_url,
            'updatedAt' => $collection->updated_at->timestamp * 1000,
        ]);
    }

    /**
     * Delete a collection
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|integer|exists:collections,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $collection->delete();

        return response()->json(['message' => 'Collection deleted successfully']);
    }

    /**
     * Add a post to a collection
     */
    public function addPost(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['id' => $id]), [
            'id' => 'required|integer|exists:collections,id',
            'post_id' => 'required|uuid|exists:posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $post = Post::findOrFail($request->post_id);

        // Check if post is already in collection
        if ($collection->posts()->where('post_id', $post->id)->exists()) {
            return response()->json(['message' => 'Post already in collection'], 200);
        }

        DB::beginTransaction();
        try {
            $collection->posts()->attach($post->id);

            // Update thumbnail if collection is empty
            if (!$collection->thumbnail_url && $post->media_url) {
                $collection->thumbnail_url = $post->media_url;
                $collection->save();
            }

            $collection->touch(); // Update updated_at

            DB::commit();

            return response()->json([
                'message' => 'Post added to collection',
                'collection' => [
                    'id' => (string) $collection->id,
                    'thumbnailUrl' => $collection->thumbnail_url,
                    'updatedAt' => $collection->updated_at->timestamp * 1000,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to add post to collection'], 500);
        }
    }

    /**
     * Remove a post from a collection
     */
    public function removePost(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['id' => $id]), [
            'id' => 'required|integer|exists:collections,id',
            'post_id' => 'required|uuid|exists:posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $post = Post::findOrFail($request->post_id);

        DB::beginTransaction();
        try {
            $collection->posts()->detach($post->id);

            // Update thumbnail if collection becomes empty or if removed post was the thumbnail
            if ($collection->posts()->count() === 0) {
                $collection->thumbnail_url = null;
            } else {
                // Update thumbnail to first post if current thumbnail was removed
                $firstPost = $collection->posts()->first();
                if ($firstPost && $firstPost->media_url) {
                    $collection->thumbnail_url = $firstPost->media_url;
                }
            }
            $collection->save();
            $collection->touch(); // Update updated_at

            DB::commit();

            return response()->json([
                'message' => 'Post removed from collection',
                'collection' => [
                    'id' => (string) $collection->id,
                    'thumbnailUrl' => $collection->thumbnail_url,
                    'updatedAt' => $collection->updated_at->timestamp * 1000,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to remove post from collection'], 500);
        }
    }

    /**
     * Get collections that contain a specific post
     */
    public function getCollectionsForPost(Request $request, string $postId): JsonResponse
    {
        $validator = Validator::make(['post_id' => $postId], [
            'post_id' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $post = Post::findOrFail($postId);

        $collections = Collection::where('user_id', $user->id)
            ->whereHas('posts', function ($query) use ($postId) {
                $query->where('posts.id', $postId);
            })
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($collection) {
                return [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
                    'isPrivate' => $collection->is_private,
                    'thumbnailUrl' => $collection->thumbnail_url,
                    'postIds' => $collection->posts()->pluck('posts.id')->toArray(),
                    'updatedAt' => $collection->updated_at->timestamp * 1000,
                ];
            });

        return response()->json($collections);
    }

    /**
     * Get all posts in a collection
     */
    public function getCollectionPosts(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|integer|exists:collections,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $posts = $collection->posts()
            ->orderBy('collection_posts.created_at', 'desc')
            ->get()
            ->map(function ($post) {
                return [
                    'id' => $post->id,
                    'userHandle' => $post->user_handle,
                    'text' => $post->text_content,
                    'mediaUrl' => $post->media_url,
                    'mediaType' => $post->media_type,
                    'locationLabel' => $post->location_label,
                    'tags' => $post->tags ?? [],
                    'createdAt' => $post->created_at->timestamp * 1000,
                    'stats' => [
                        'likes' => $post->likes_count ?? 0,
                        'views' => $post->views_count ?? 0,
                        'comments' => $post->comments_count ?? 0,
                        'shares' => $post->shares_count ?? 0,
                        'reclips' => $post->reclips_count ?? 0,
                    ],
                ];
            });

        return response()->json($posts);
    }
}

