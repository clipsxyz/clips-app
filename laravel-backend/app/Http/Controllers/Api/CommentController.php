<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use App\Services\BoostAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CommentController extends Controller
{
    /**
     * Get comments for a post
     */
    public function getPostComments(Request $request, string $postId): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['postId' => $postId]), [
            'postId' => 'required|uuid|exists:posts,id',
            'cursor' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:100',
            'repliesLimit' => 'nullable|integer|min:1|max:25',
            'paged' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $userId = $request->get('userId');
        $hasViewer = !empty($userId);
        $limit = max(1, min((int) $request->get('limit', 30), 100));
        $repliesLimit = max(1, min((int) $request->get('repliesLimit', 5), 25));
        $cursorState = $this->decodeCommentCursor((string) $request->get('cursor', ''));
        $isPaged = filter_var($request->get('paged', false), FILTER_VALIDATE_BOOLEAN);

        $query = Comment::topLevel()
            ->where('post_id', $postId)
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'replies'])
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($cursorState['created_at'] && $cursorState['id']) {
            $query->where(function ($q) use ($cursorState) {
                $q->where('created_at', '<', $cursorState['created_at'])
                    ->orWhere(function ($q2) use ($cursorState) {
                        $q2->where('created_at', '=', $cursorState['created_at'])
                            ->where('id', '<', $cursorState['id']);
                    });
            });
        }

        if ($hasViewer) {
            $query->withExists([
                'likes as user_liked' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ]);
        }

        $comments = $query->limit($limit + 1)->get();
        $hasMore = $comments->count() > $limit;
        if ($hasMore) {
            $comments = $comments->take($limit)->values();
        }
        $lastComment = $comments->last();
        $nextCursor = null;
        if ($hasMore && $lastComment) {
            $nextCursor = $this->encodeCommentCursor(
                $lastComment->created_at->format('Y-m-d H:i:s'),
                (string) $lastComment->id
            );
        }

        // Load replies for each comment
        $comments->load(['replies' => function ($query) use ($userId, $hasViewer, $repliesLimit) {
            $query->with(['user:id,handle,display_name,avatar_url'])
                ->withCount(['likes'])
                ->orderBy('created_at', 'desc')
                ->orderBy('id', 'desc')
                ->limit($repliesLimit);
            
            if ($hasViewer) {
                $query->withExists([
                    'likes as user_liked' => function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    },
                ]);
            }
        }]);

        // Transform comments using already eager-loaded relations
        $transformedComments = $comments->map(function ($comment) use ($hasViewer) {
            $commentData = $comment->toArray();
            $attrs = $comment->getAttributes();

            $commentData['user_liked'] = $hasViewer
                ? (array_key_exists('user_liked', $attrs) ? (bool) $attrs['user_liked'] : false)
                : false;

            if ($comment->relationLoaded('replies')) {
                $commentData['replies'] = $comment->replies->map(function ($reply) use ($hasViewer) {
                    $replyData = $reply->toArray();
                    $replyAttrs = $reply->getAttributes();
                    $replyData['user_liked'] = $hasViewer
                        ? (array_key_exists('user_liked', $replyAttrs) ? (bool) $replyAttrs['user_liked'] : false)
                        : false;
                    return $replyData;
                })->toArray();
            }

            return $commentData;
        });

        if ($isPaged || $request->filled('cursor')) {
            return response()->json([
                'items' => $transformedComments,
                'nextCursor' => $nextCursor,
                'hasMore' => $hasMore,
            ]);
        }

        return response()->json($transformedComments);
    }

    /**
     * Add comment to post
     */
    public function store(Request $request, string $postId): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['postId' => $postId]), [
            'postId' => 'required|uuid|exists:posts,id',
            'text' => 'required|string|min:1|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();

        $comment = DB::transaction(function () use ($request, $user, $postId) {
            $comment = Comment::create([
                'post_id' => $postId,
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
            ]);

            // Update post comment count
            Post::find($postId)->increment('comments_count');
            BoostAnalyticsService::incrementForPost($postId, 'comments_count');

            return $comment;
        });

        return response()->json($comment, 201);
    }

    /**
     * Add reply to comment
     */
    public function reply(Request $request, string $parentId): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['parentId' => $parentId]), [
            'parentId' => 'required|uuid|exists:comments,id',
            'text' => 'required|string|min:1|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $parentComment = Comment::findOrFail($parentId);

        $reply = DB::transaction(function () use ($request, $user, $parentComment) {
            $reply = Comment::create([
                'post_id' => $parentComment->post_id,
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
                'parent_id' => $parentComment->id,
            ]);

            // Update parent comment replies count
            $parentComment->increment('replies_count');

            // Update post comment count
            Post::find($parentComment->post_id)->increment('comments_count');
            BoostAnalyticsService::incrementForPost($parentComment->post_id, 'comments_count');

            return $reply;
        });

        return response()->json($reply, 201);
    }

    /**
     * Toggle like on comment
     */
    public function toggleLike(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:comments,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $comment = Comment::findOrFail($id);

        $result = DB::transaction(function () use ($user, $comment) {
            $existingLike = $user->commentLikes()->where('comment_id', $comment->id)->first();

            if ($existingLike) {
                // Unlike
                $user->commentLikes()->detach($comment->id);
                $comment->decrement('likes_count');
                return ['liked' => false];
            } else {
                // Like
                $user->commentLikes()->attach($comment->id);
                $comment->increment('likes_count');
                return ['liked' => true];
            }
        });

        return response()->json($result);
    }

    private function decodeCommentCursor(?string $cursor): array
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

    private function encodeCommentCursor(string $createdAt, string $id): string
    {
        return rtrim(strtr(base64_encode($createdAt . '|' . $id), '+/', '-_'), '=');
    }
}
