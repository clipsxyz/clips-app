<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Post;
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
            ->with(['posts' => function ($query) {
                $query->select(
                    'posts.id',
                    'posts.media_url',
                    'posts.media_type',
                    'posts.thumbnail_url',
                    'posts.media_items'
                );
            }])
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($collection) {
                $first = $collection->posts->first();
                $thumbnailUrl = $this->coverUrlForPost($first, $collection->thumbnail_url);

                return [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
                    'isPrivate' => $collection->is_private,
                    'thumbnailUrl' => $thumbnailUrl,
                    'postIds' => $collection->posts->pluck('id')->values()->all(),
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

            $post = null;
            // If post_id is provided, add it to the collection
            if ($request->has('post_id')) {
                $post = Post::findOrFail($request->post_id);
                $collection->posts()->attach($post->id);
                $this->syncUniqueSaveAfterAttach($user, $post);

                // Set thumbnail from post if it has media
                $cover = $post->collectionCoverUrl();
                if ($cover) {
                    $collection->thumbnail_url = $cover;
                    $collection->save();
                }
            }

            DB::commit();

            $payload = [
                'id' => (string) $collection->id,
                'userId' => $collection->user_id,
                'name' => $collection->name,
                'isPrivate' => $collection->is_private,
                'thumbnailUrl' => $collection->thumbnail_url,
                'postIds' => $collection->posts()->pluck('posts.id')->toArray(),
                'createdAt' => $collection->created_at->timestamp * 1000,
                'updatedAt' => $collection->updated_at->timestamp * 1000,
            ];
            if (isset($post)) {
                $payload['saves_count'] = (int) $post->fresh()?->saves_count;
                $payload['is_bookmarked'] = true;
            }

            return response()->json($payload, 201);
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
            ->with(['posts.user', 'posts.taggedUsers'])
            ->firstOrFail();

        return response()->json($this->serializeCollection($collection, $user));
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

        $postIds = $collection->posts()->pluck('posts.id');
        $collection->delete();
        foreach ($postIds as $postId) {
            $post = Post::find($postId);
            if ($post) {
                $this->syncUniqueSaveAfterDetach($user, $post);
            }
        }

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
            $savesCount = $this->syncUniqueSaveAfterAttach($user, $post);

            $cover = $post->collectionCoverUrl();
            if ($cover) {
                $collection->thumbnail_url = $cover;
                $collection->save();
            }

            $collection->touch(); // Update updated_at

            DB::commit();

            return response()->json([
                'message' => 'Post added to collection',
                'saves_count' => $savesCount,
                'is_bookmarked' => true,
                'collection' => [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
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
            $savesCount = $this->syncUniqueSaveAfterDetach($user, $post);

            // Update thumbnail if collection becomes empty or if removed post was the thumbnail
            if ($collection->posts()->count() === 0) {
                $collection->thumbnail_url = null;
            } else {
                $firstPost = $collection->posts()->first();
                $collection->thumbnail_url = $this->coverUrlForPost($firstPost);
            }
            $collection->save();
            $collection->touch(); // Update updated_at

            DB::commit();

            return response()->json([
                'message' => 'Post removed from collection',
                'saves_count' => $savesCount,
                'is_bookmarked' => $user->hasBookmarked($post),
                'collection' => [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
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

        $collections = Collection::where('user_id', $user->id)
            ->whereHas('posts', function ($query) use ($postId) {
                $query->where('posts.id', $postId);
            })
            ->with(['posts' => function ($query) {
                $query->select('posts.id');
            }])
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($collection) {
                return [
                    'id' => (string) $collection->id,
                    'userId' => $collection->user_id,
                    'name' => $collection->name,
                    'isPrivate' => $collection->is_private,
                    'thumbnailUrl' => $collection->thumbnail_url,
                    'postIds' => $collection->posts->pluck('id')->values()->all(),
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

        $collection->load(['posts.user', 'posts.taggedUsers']);

        return response()->json(
            $collection->posts
                ->map(fn ($post) => PostController::toApiArray($post, $user))
                ->values()
        );
    }

    private function serializeCollection(Collection $collection, $user): array
    {
        $collection->loadMissing(['posts.user', 'posts.taggedUsers']);
        $posts = $collection->posts->values();

        return [
            'id' => (string) $collection->id,
            'userId' => $collection->user_id,
            'name' => $collection->name,
            'isPrivate' => $collection->is_private,
            'thumbnailUrl' => $this->coverUrlForPost($posts->first(), $collection->thumbnail_url),
            'postIds' => $posts->pluck('id')->values()->all(),
            'posts' => $posts->map(fn ($post) => PostController::toApiArray($post, $user))->values()->all(),
            'createdAt' => $collection->created_at->timestamp * 1000,
            'updatedAt' => $collection->updated_at->timestamp * 1000,
        ];
    }

    private function coverUrlForPost(?Post $post, ?string $stored = null): ?string
    {
        if ($post) {
            $cover = $post->collectionCoverUrl();
            if (is_string($cover) && trim($cover) !== '') {
                return $cover;
            }
        }

        return is_string($stored) && trim($stored) !== '' ? $stored : null;
    }

    private function syncUniqueSaveAfterAttach($user, Post $post): int
    {
        $post->recordSaveForUser($user);

        return (int) $post->fresh()->saves_count;
    }

    private function syncUniqueSaveAfterDetach($user, Post $post): int
    {
        $stillSaved = Collection::query()
            ->where('user_id', $user->id)
            ->whereHas('posts', function ($q) use ($post) {
                $q->where('posts.id', $post->id);
            })
            ->exists();
        if (! $stillSaved) {
            $post->clearSaveForUser($user);
        }

        return (int) $post->fresh()->saves_count;
    }
}

