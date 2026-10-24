<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CollectionResource;
use App\Models\Collection;
use App\Models\Post;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CollectionController extends Controller
{
    private function eagerLoadCoverPosts(Builder $query): Builder
    {
        return $query->with(['posts' => function ($posts) {
            $posts->select(
                'posts.id',
                'posts.media_url',
                'posts.media_type',
                'posts.thumbnail_url',
                'posts.media_items'
            )->orderByDesc('collection_posts.created_at');
        }]);
    }

    /**
     * Get all collections for authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        $collections = $this->eagerLoadCoverPosts(
            Collection::where('user_id', $user->id)->withCount('posts')
        )
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn (Collection $collection) => (new CollectionResource($collection))->resolve())
            ->values();

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
                
                $collection->updateThumbnail();
            }

            DB::commit();

            $collection->load(['posts' => function ($query) {
                $query->select(
                    'posts.id',
                    'posts.media_url',
                    'posts.media_type',
                    'posts.thumbnail_url',
                    'posts.media_items'
                )->orderByDesc('collection_posts.created_at');
            }]);

            return response()->json($collection->toApiArray(), 201);
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
        $user = Auth::user();
        $collection = Collection::where('user_id', $user->id)
            ->where(function ($query) use ($id) {
                $query->where('id', $id);
                if (ctype_digit($id)) {
                    $query->orWhere('id', (int) $id);
                }
            })
            ->with(['posts' => function ($query) {
                $query->orderBy('collection_posts.created_at', 'desc');
            }])
            ->first();

        if (!$collection) {
            return response()->json(['error' => 'Collection not found'], 404);
        }

        $payload = $collection->toApiArray();

        return response()->json(array_merge($payload, [
            'posts' => $collection->posts->map(function ($post) {
                return [
                    'id' => $post->id,
                    'userHandle' => $post->user_handle,
                    'text' => $post->text_content,
                    'mediaUrl' => $post->media_url,
                    'mediaType' => $post->media_type,
                    'thumbnail_url' => $post->thumbnail_url,
                    'thumbnailUrl' => $post->thumbnail_url,
                    'video_url' => $post->media_type === 'video' ? $post->media_url : null,
                    'videoPosterUrl' => $post->thumbnail_url,
                    'locationLabel' => $post->location_label,
                    'tags' => $post->tags ?? [],
                    'createdAt' => $post->created_at->timestamp * 1000,
                    'likes_count' => $post->likes_count ?? 0,
                    'views_count' => $post->views_count ?? 0,
                    'comments_count' => $post->comments_count ?? 0,
                    'shares_count' => $post->shares_count ?? 0,
                    'reclips_count' => $post->reclips_count ?? 0,
                    'stats' => [
                        'likes' => $post->likes_count ?? 0,
                        'views' => $post->views_count ?? 0,
                        'comments' => $post->comments_count ?? 0,
                        'shares' => $post->shares_count ?? 0,
                        'reclips' => $post->reclips_count ?? 0,
                    ],
                ];
            }),
            'createdAt' => $collection->created_at->timestamp * 1000,
            'updatedAt' => $collection->updated_at->timestamp * 1000,
        ]));
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

        return response()->json($collection->fresh()->toApiArray());
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
        $validator = Validator::make($request->all(), [
            'post_id' => 'required|uuid|exists:posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $collection = Collection::where('user_id', $user->id)
            ->where(function ($query) use ($id) {
                $query->where('id', $id);
                if (ctype_digit((string) $id)) {
                    $query->orWhere('id', (int) $id);
                }
            })
            ->first();

        if (!$collection) {
            return response()->json(['error' => 'Collection not found'], 404);
        }

        $post = Post::findOrFail($request->post_id);

        DB::beginTransaction();
        try {
            $collection->posts()->syncWithoutDetaching([$post->id]);

            $default = Collection::findOrCreateDefaultForUser($user->id);
            if ((int) $default->id !== (int) $collection->id) {
                $default->posts()->syncWithoutDetaching([$post->id]);
                $default->updateThumbnail();
            }

            $collection->updateThumbnail();

            $collection->touch(); // Update updated_at

            DB::commit();

            $collection->load(['posts' => function ($query) {
                $query->select(
                    'posts.id',
                    'posts.media_url',
                    'posts.media_type',
                    'posts.thumbnail_url',
                    'posts.media_items'
                )->orderByDesc('collection_posts.created_at');
            }]);

            return response()->json([
                'message' => 'Post added to collection',
                'collection' => $collection->toApiArray(),
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

            $collection->unsetRelation('posts');
            $collection->updateThumbnail();
            $collection->touch(); // Update updated_at

            DB::commit();

            return response()->json([
                'message' => 'Post removed from collection',
                'collection' => $collection->fresh()->toApiArray(),
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

        $collections = $this->eagerLoadCoverPosts(
            Collection::where('user_id', $user->id)
                ->whereHas('posts', function ($query) use ($postId) {
                    $query->where('posts.id', $postId);
                })
        )
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn (Collection $collection) => $collection->toApiArray())
            ->values();

        return response()->json($collections);
    }

    /**
     * Get all posts in a collection
     */
    public function getCollectionPosts(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        $collection = Collection::where('user_id', $user->id)
            ->where(function ($query) use ($id) {
                $query->where('id', $id);
                if (ctype_digit($id)) {
                    $query->orWhere('id', (int) $id);
                }
            })
            ->first();

        if (!$collection) {
            return response()->json(['error' => 'Collection not found'], 404);
        }

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

