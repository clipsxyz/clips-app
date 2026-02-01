<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MessageController extends Controller
{
    /**
     * Get conversation between two users
     */
    public function getConversation(Request $request, string $otherHandle): JsonResponse
    {
        $validator = Validator::make(['otherHandle' => $otherHandle], [
            'otherHandle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $conversationId = Message::getConversationId($user->handle, $otherHandle);

        $messages = Message::where('conversation_id', $conversationId)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    /**
     * Get all conversations for authenticated user
     */
    public function getConversations(Request $request): JsonResponse
    {
        $user = Auth::user();
        $cursor = $request->get('cursor', 0);
        $limit = $request->get('limit', 20);
        $offset = $cursor * $limit;

        // Get all unique conversation IDs
        $conversationIds = Message::where(function ($q) use ($user) {
            $q->where('sender_handle', $user->handle)
              ->orWhere('recipient_handle', $user->handle);
        })
        ->distinct()
        ->pluck('conversation_id');

        // Get latest message for each conversation
        $conversations = [];
        foreach ($conversationIds as $conversationId) {
            $latestMessage = Message::where('conversation_id', $conversationId)
                ->orderBy('created_at', 'desc')
                ->first();

            if ($latestMessage) {
                // Extract other user's handle
                $otherHandle = $latestMessage->sender_handle === $user->handle 
                    ? $latestMessage->recipient_handle 
                    : $latestMessage->sender_handle;

                $otherUser = User::where('handle', $otherHandle)->first();
                
                $conversations[] = [
                    'conversation_id' => $conversationId,
                    'other_user' => $otherUser ? [
                        'handle' => $otherUser->handle,
                        'display_name' => $otherUser->display_name,
                        'avatar_url' => $otherUser->avatar_url,
                    ] : null,
                    'latest_message' => $latestMessage,
                    'unread_count' => Message::where('conversation_id', $conversationId)
                        ->where('recipient_handle', $user->handle)
                        ->where('is_system_message', false)
                        ->whereNull('read_at')
                        ->count(),
                ];
            }
        }

        // Sort by latest message timestamp
        usort($conversations, function ($a, $b) {
            return $b['latest_message']->created_at <=> $a['latest_message']->created_at;
        });

        $paginated = array_slice($conversations, $offset, $limit);
        $nextCursor = count($conversations) > ($offset + $limit) ? $cursor + 1 : null;

        return response()->json([
            'items' => $paginated,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
        ]);
    }

    /**
     * Send a message
     */
    public function sendMessage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'recipient_handle' => 'required|string|exists:users,handle',
            'text' => 'nullable|string|max:1000',
            'image_url' => 'nullable|url|max:500',
            'is_system_message' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        if (!$request->text && !$request->image_url) {
            return response()->json(['error' => 'Message must have text or image'], 400);
        }

        $user = Auth::user();
        $recipientHandle = $request->recipient_handle;
        $recipient = User::where('handle', $recipientHandle)->firstOrFail();

        if ($user->handle === $recipientHandle) {
            return response()->json(['error' => 'Cannot send message to yourself'], 400);
        }

        // Check if user can send message (privacy check)
        if (!$recipient->canSendMessage($user)) {
            return response()->json([
                'error' => 'Cannot send message',
                'message' => 'You must follow this user to send them a message'
            ], 403);
        }

        $message = DB::transaction(function () use ($request, $user, $recipientHandle) {
            $conversationId = Message::getConversationId($user->handle, $recipientHandle);

            $message = Message::create([
                'conversation_id' => $conversationId,
                'sender_handle' => $user->handle,
                'recipient_handle' => $recipientHandle,
                'text' => $request->text,
                'image_url' => $request->image_url,
                'is_system_message' => $request->boolean('is_system_message', false),
            ]);

            // TODO: Create notification if needed (sticker, reply detection)
            // This would be handled by a service or event listener

            return $message;
        });

        return response()->json($message, 201);
    }

    /**
     * Mark all messages in a conversation as read (for the authenticated user as recipient).
     */
    public function markConversationRead(Request $request, string $otherHandle): JsonResponse
    {
        $validator = Validator::make(['otherHandle' => $otherHandle], [
            'otherHandle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $conversationId = Message::getConversationId($user->handle, $otherHandle);

        Message::where('conversation_id', $conversationId)
            ->where('recipient_handle', $user->handle)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }
}


