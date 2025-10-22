<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CommentController extends Controller
{
    /**
     * Get comments for a post
     */
    public function getPostComments(Request $request, string $postId): JsonResponse
    {
        $validator = Validator::make(['postId' => $postId], [
            'postId' => 'required|uuid|exists:posts,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $userId = $request->get('userId');

        $query = Comment::topLevel()
            ->where('post_id', $postId)
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['likes', 'replies']);

        if ($userId) {
            $query->with(['likes' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }]);
        }

        $comments = $query->orderBy('created_at', 'desc')->get();

        // Load replies for each comment
        $comments->load(['replies' => function ($query) use ($userId) {
            $query->with(['user:id,handle,display_name,avatar_url'])
                  ->withCount(['likes']);
            
            if ($userId) {
                $query->with(['likes' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                }]);
            }
        }]);

        // Transform comments to include user-specific data
        $transformedComments = $comments->map(function ($comment) use ($userId) {
            $commentData = $comment->toArray();
            
            if ($userId) {
                $commentData['user_liked'] = $comment->isLikedBy(User::find($userId));
                
                // Transform replies
                if (isset($commentData['replies'])) {
                    $commentData['replies'] = collect($commentData['replies'])->map(function ($reply) use ($userId) {
                        $replyData = $reply;
                        $replyData['user_liked'] = Comment::find($reply['id'])->isLikedBy(User::find($userId));
                        return $replyData;
                    })->toArray();
                }
            } else {
                $commentData['user_liked'] = false;
                
                if (isset($commentData['replies'])) {
                    $commentData['replies'] = collect($commentData['replies'])->map(function ($reply) {
                        $replyData = $reply;
                        $replyData['user_liked'] = false;
                        return $replyData;
                    })->toArray();
                }
            }

            return $commentData;
        });

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
}
