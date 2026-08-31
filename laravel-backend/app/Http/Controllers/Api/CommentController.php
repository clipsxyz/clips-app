<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use App\Services\BoostAnalyticsService;
use App\Services\InteractionPushService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            'paged' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $viewer = Auth::user();
        $userId = $viewer instanceof User ? (string) $viewer->id : $request->get('userId');
        $hasViewer = !empty($userId);
        $limit = max(1, min((int) $request->get('limit', 30), 100));
        $repliesLimit = max(1, min((int) $request->get('repliesLimit', 5), 25));
        $cursorState = $this->decodeCommentCursor((string) $request->get('cursor', ''));
        $isPaged = filter_var($request->get('paged', false), FILTER_VALIDATE_BOOLEAN);

        $post = Post::query()->select('id', 'user_id')->find($postId);
        $postOwnerId = $post?->user_id ? (string) $post->user_id : null;
        $viewerModel = $viewer instanceof User ? $viewer : ($hasViewer ? User::query()->find($userId) : null);

        $query = Comment::topLevel()
            ->where('post_id', $postId)
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'replies'])
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');
        $this->constrainVisibleComments($query, $viewerModel instanceof User ? $viewerModel : null, $postOwnerId);

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
        $comments->load(['replies' => function ($query) use ($userId, $hasViewer, $repliesLimit, $viewerModel, $postOwnerId) {
            $query->with(['user:id,handle,display_name,avatar_url'])
                ->withCount(['likes'])
                ->orderBy('created_at', 'desc')
                ->orderBy('id', 'desc')
                ->limit($repliesLimit);
            $this->constrainVisibleComments($query, $viewerModel instanceof User ? $viewerModel : null, $postOwnerId);

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
            'text' => 'required|string|min:1|max:500',
            'moderation_status' => 'nullable|in:approved,pending_review,hidden',
            'is_hidden' => 'nullable|boolean',
            'flagged_keywords' => 'nullable|array|max:20',
            'flagged_keywords.*' => 'string|max:80',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();

        $comment = DB::transaction(function () use ($request, $user, $postId) {
            $comment = Comment::create(array_merge([
                'post_id' => $postId,
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
            ], $this->moderationAttributesFromRequest($request)));

            // Update post comment count
            Post::find($postId)->increment('comments_count');
            BoostAnalyticsService::incrementForPost($postId, 'comments_count');
            Post::bumpFeedCache();

            return $comment;
        });

        $comment->load(['user:id,handle,display_name,avatar_url']);
        $post = Post::query()->select('id', 'user_id', 'comments_count')->find($postId);
        if ($post && $post->user_id && $post->user_id !== $user->id) {
            $owner = User::find($post->user_id);
            if ($owner) {
                try {
                    (new InteractionPushService)->notifyComment(
                        $user,
                        $owner,
                        (string) $post->id,
                        (string) $comment->id,
                        (string) $request->text
                    );
                } catch (\Throwable $e) {
                    \Log::warning('comment notify failed: '.$e->getMessage());
                }
            }
        }

        return response()->json(array_merge($comment->toArray(), [
            'comments_count' => (int) ($post?->comments_count ?? 0),
        ]), 201);
    }

    /**
     * Add reply to comment
     */
    public function reply(Request $request, string $parentId): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['parentId' => $parentId]), [
            'parentId' => 'required|uuid|exists:comments,id',
            'text' => 'required|string|min:1|max:500',
            'moderation_status' => 'nullable|in:approved,pending_review,hidden',
            'is_hidden' => 'nullable|boolean',
            'flagged_keywords' => 'nullable|array|max:20',
            'flagged_keywords.*' => 'string|max:80',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $parentComment = Comment::findOrFail($parentId);

        $reply = DB::transaction(function () use ($request, $user, $parentComment) {
            $reply = Comment::create(array_merge([
                'post_id' => $parentComment->post_id,
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => $request->text,
                'parent_id' => $parentComment->id,
            ], $this->moderationAttributesFromRequest($request)));

            // Update parent comment replies count
            $parentComment->increment('replies_count');

            // Update post comment count
            Post::find($parentComment->post_id)->increment('comments_count');
            BoostAnalyticsService::incrementForPost($parentComment->post_id, 'comments_count');
            Post::bumpFeedCache();

            return $reply;
        });

        $reply->load(['user:id,handle,display_name,avatar_url']);
        $post = Post::query()->select('id', 'user_id', 'comments_count')->find($parentComment->post_id);

        // Notify parent comment author (reply) and post owner when different.
        $push = new InteractionPushService;
        try {
            if ($parentComment->user_id && $parentComment->user_id !== $user->id) {
                $parentAuthor = User::find($parentComment->user_id);
                if ($parentAuthor) {
                    $push->notifyComment(
                        $user,
                        $parentAuthor,
                        (string) $parentComment->post_id,
                        (string) $reply->id,
                        (string) $request->text
                    );
                }
            }
            if (
                $post
                && $post->user_id
                && $post->user_id !== $user->id
                && $post->user_id !== $parentComment->user_id
            ) {
                $owner = User::find($post->user_id);
                if ($owner) {
                    $push->notifyComment(
                        $user,
                        $owner,
                        (string) $post->id,
                        (string) $reply->id,
                        (string) $request->text
                    );
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('comment reply notify failed: '.$e->getMessage());
        }

        return response()->json(array_merge($reply->toArray(), [
            'comments_count' => (int) ($post?->comments_count ?? 0),
        ]), 201);
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

    /**
     * Post owner: hide a comment, or unhide if it is already hidden (toggle).
     */
    public function hide(Request $request, string $id): JsonResponse
    {
        $comment = $this->findOwnedCommentOrFail($id);
        if ($comment instanceof JsonResponse) {
            return $comment;
        }

        $currentlyHidden = $comment->isHiddenFromPublic();
        if ($currentlyHidden) {
            $comment->is_hidden = false;
            $comment->moderation_status = 'approved';
        } else {
            $keywords = $request->input('flagged_keywords');
            $comment->is_hidden = true;
            $comment->moderation_status = 'hidden';
            if (is_array($keywords)) {
                $comment->flagged_keywords = array_values(array_filter(array_map(
                    static fn ($word) => mb_substr(trim((string) $word), 0, 80),
                    $keywords
                )));
            } elseif (empty($comment->flagged_keywords)) {
                $comment->flagged_keywords = ['creator_moderation'];
            }
        }
        $comment->save();

        return response()->json($comment->fresh()->toArray());
    }

    /**
     * Post owner: approve a hidden / pending comment so it is public again.
     */
    public function approve(string $id): JsonResponse
    {
        $comment = $this->findOwnedCommentOrFail($id);
        if ($comment instanceof JsonResponse) {
            return $comment;
        }

        $comment->is_hidden = false;
        $comment->moderation_status = 'approved';
        $comment->save();

        return response()->json($comment->fresh()->toArray());
    }

    /**
     * Hidden / pending comments on the authenticated creator's posts.
     */
    public function reviewQueue(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (! $this->commentsHaveModerationColumns()) {
            return response()->json(['items' => [], 'matched_count' => 0]);
        }

        $limit = max(1, min((int) $request->get('limit', 100), 200));
        $rows = Comment::query()
            ->whereHas('post', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->where(function ($q) {
                $q->where('is_hidden', true)
                    ->orWhereIn('moderation_status', ['hidden', 'pending_review']);
            })
            ->with(['user:id,handle,display_name,avatar_url', 'post:id,user_id,user_handle'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        $items = $rows->map(function (Comment $comment) {
            $keywords = is_array($comment->flagged_keywords) ? $comment->flagged_keywords : [];
            $createdAt = $comment->created_at;
            $createdMs = $createdAt ? $createdAt->getTimestamp() * 1000 : (int) round(microtime(true) * 1000);

            return [
                'id' => (string) $comment->id,
                'post_id' => (string) $comment->post_id,
                'postId' => (string) $comment->post_id,
                'user_handle' => $comment->user_handle,
                'userHandle' => $comment->user_handle,
                'text_content' => $comment->text_content,
                'text' => $comment->text_content,
                'created_at' => $createdAt?->toIso8601String(),
                'createdAt' => $createdMs,
                'moderation_status' => $comment->moderation_status,
                'is_hidden' => (bool) $comment->is_hidden,
                'flagged_keywords' => $keywords,
                'moderationReason' => $keywords[0] ?? ($comment->moderation_status === 'hidden' ? 'creator_moderation' : null),
                'isReply' => $comment->isReply(),
                'parent_id' => $comment->parent_id,
                'parentId' => $comment->parent_id,
            ];
        })->values();

        return response()->json([
            'items' => $items,
            'matched_count' => $items->count(),
        ]);
    }

    /**
     * Post owner: permanently delete a comment or reply.
     */
    public function destroy(string $id): JsonResponse
    {
        $comment = $this->findOwnedCommentOrFail($id);
        if ($comment instanceof JsonResponse) {
            return $comment;
        }

        DB::transaction(function () use ($comment) {
            $postId = $comment->post_id;
            $parentId = $comment->parent_id;
            $comment->delete();
            if ($parentId) {
                Comment::query()->where('id', $parentId)->decrement('replies_count');
            }
            $post = Post::query()->find($postId);
            if ($post && (int) $post->comments_count > 0) {
                $post->decrement('comments_count');
            }
            Post::bumpFeedCache();
        });

        return response()->json(['ok' => true]);
    }

    /**
     * @return Comment|JsonResponse
     */
    private function findOwnedCommentOrFail(string $id)
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:comments,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $comment = Comment::query()->with('post:id,user_id')->findOrFail($id);
        $postOwnerId = $comment->post?->user_id;
        if (! $postOwnerId || (string) $postOwnerId !== (string) $user->id) {
            return response()->json(['error' => 'Only the post creator can moderate comments'], 403);
        }

        return $comment;
    }

    private function constrainVisibleComments($query, ?User $viewer, ?string $postOwnerId): void
    {
        if (! $this->commentsHaveModerationColumns()) {
            return;
        }
        $query->visibleTo($viewer, $postOwnerId);
    }

    /** @return array<string, mixed> */
    private function moderationAttributesFromRequest(Request $request): array
    {
        if (! $this->commentsHaveModerationColumns()) {
            return [];
        }

        $status = $request->input('moderation_status');
        $hidden = $request->boolean('is_hidden');
        $keywords = $request->input('flagged_keywords');
        $attrs = [];

        if (is_string($status) && in_array($status, ['approved', 'pending_review', 'hidden'], true)) {
            $attrs['moderation_status'] = $status;
            if ($status === 'hidden' || $status === 'pending_review') {
                $attrs['is_hidden'] = true;
            }
        }
        if ($request->exists('is_hidden')) {
            $attrs['is_hidden'] = $hidden;
        }
        if (is_array($keywords)) {
            $attrs['flagged_keywords'] = array_values(array_filter(array_map(
                static fn ($word) => mb_substr(trim((string) $word), 0, 80),
                $keywords
            )));
        }

        return $attrs;
    }

    private function commentsHaveModerationColumns(): bool
    {
        static $has = null;
        if ($has === null) {
            $has = Schema::hasColumn('comments', 'moderation_status');
        }

        return $has;
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
