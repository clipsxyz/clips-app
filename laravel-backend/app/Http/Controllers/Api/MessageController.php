<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
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

        // Direct messages only (exclude group rows where recipient is null)
        $conversationIds = Message::query()
            ->whereNull('chat_group_id')
            ->where(function ($q) use ($user) {
                $q->where('sender_handle', $user->handle)
                    ->orWhere('recipient_handle', $user->handle);
            })
            ->distinct()
            ->pluck('conversation_id');

        $conversations = [];
        foreach ($conversationIds as $conversationId) {
            $latestMessage = Message::where('conversation_id', $conversationId)
                ->whereNull('chat_group_id')
                ->orderBy('created_at', 'desc')
                ->first();

            if ($latestMessage) {
                $otherHandle = $latestMessage->sender_handle === $user->handle
                    ? $latestMessage->recipient_handle
                    : $latestMessage->sender_handle;

                $otherUser = User::where('handle', $otherHandle)->first();

                $conversations[] = [
                    'type' => 'dm',
                    'conversation_id' => $conversationId,
                    'other_user' => $otherUser ? [
                        'handle' => $otherUser->handle,
                        'display_name' => $otherUser->display_name,
                        'avatar_url' => $otherUser->avatar_url,
                    ] : null,
                    'latest_message' => $latestMessage,
                    'unread_count' => Message::where('conversation_id', $conversationId)
                        ->whereNull('chat_group_id')
                        ->where('recipient_handle', $user->handle)
                        ->where('is_system_message', false)
                        ->whereNull('read_at')
                        ->count(),
                    'group_updated_at' => null,
                ];
            }
        }

        // Group chats: active memberships on non-deleted groups
        $memberships = ChatGroupMember::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->whereHas('chatGroup', fn ($q) => $q->whereNull('deleted_at'))
            ->with('chatGroup')
            ->get();

        foreach ($memberships as $gm) {
            $group = $gm->chatGroup;
            $latestMessage = Message::where('chat_group_id', $group->id)
                ->orderBy('created_at', 'desc')
                ->first();

            $since = $gm->last_read_at ?? \Carbon\Carbon::createFromTimestampUTC(0);
            $unreadCount = Message::where('chat_group_id', $group->id)
                ->where('is_system_message', false)
                ->where('sender_handle', '!=', $user->handle)
                ->where('created_at', '>', $since)
                ->count();

            $conversations[] = [
                'type' => 'group',
                'conversation_id' => $group->conversation_id,
                'chat_group_id' => $group->id,
                'group' => [
                    'id' => $group->id,
                    'name' => $group->name,
                    'creator_id' => $group->creator_id,
                ],
                'other_user' => null,
                'latest_message' => $latestMessage,
                'unread_count' => $unreadCount,
                'group_updated_at' => $group->updated_at,
            ];
        }

        usort($conversations, function ($a, $b) {
            $aTs = $a['latest_message']
                ? $a['latest_message']->created_at->getTimestamp()
                : ($a['group_updated_at'] ? $a['group_updated_at']->getTimestamp() : 0);
            $bTs = $b['latest_message']
                ? $b['latest_message']->created_at->getTimestamp()
                : ($b['group_updated_at'] ? $b['group_updated_at']->getTimestamp() : 0);

            return $bTs <=> $aTs;
        });

        $conversations = array_map(static function (array $row) {
            unset($row['group_updated_at']);

            return $row;
        }, $conversations);

        $paginated = array_slice($conversations, $offset, $limit);
        $nextCursor = count($conversations) > ($offset + $limit) ? $cursor + 1 : null;

        return response()->json([
            'items' => $paginated,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null
        ]);
    }

    /**
     * Group thread messages (same storage as DMs; conversation_id is grp:{uuid}).
     */
    public function getGroupConversation(Request $request, string $groupId): JsonResponse
    {
        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($groupId);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->hasActiveMember($user)) {
            return response()->json(['error' => 'Not a member of this group'], 403);
        }

        $messages = Message::where('chat_group_id', $group->id)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'conversation_id' => $group->conversation_id,
                'creator_id' => $group->creator_id,
            ],
            'messages' => $messages,
        ]);
    }

    /**
     * Mark group thread read for the current user (membership last_read_at).
     */
    public function markGroupRead(Request $request, string $groupId): JsonResponse
    {
        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($groupId);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        $updated = ChatGroupMember::where('chat_group_id', $group->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['last_read_at' => now()]);

        if (! $updated) {
            return response()->json(['error' => 'Not an active member'], 403);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Send a message
     */
    public function sendMessage(Request $request): JsonResponse
    {
        if ($request->filled('chat_group_id')) {
            return $this->sendGroupMessage($request);
        }

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

    protected function sendGroupMessage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'chat_group_id' => 'required|uuid|exists:chat_groups,id',
            'text' => 'nullable|string|max:1000',
            'image_url' => 'nullable|url|max:500',
            'is_system_message' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        if (! $request->text && ! $request->image_url) {
            return response()->json(['error' => 'Message must have text or image'], 400);
        }

        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($request->chat_group_id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->hasActiveMember($user)) {
            return response()->json(['error' => 'Not a member of this group'], 403);
        }

        $message = Message::create([
            'conversation_id' => $group->conversation_id,
            'chat_group_id' => $group->id,
            'sender_handle' => $user->handle,
            'recipient_handle' => null,
            'text' => $request->text,
            'image_url' => $request->image_url,
            'is_system_message' => $request->boolean('is_system_message', false),
        ]);

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


