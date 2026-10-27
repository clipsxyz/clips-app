<?php

namespace App\Services;

use App\Models\ChatGroup;
use App\Models\Message;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Creates in-app notification rows and dispatches live FCM pushes.
 */
class InteractionPushService
{
    public function __construct(
        private readonly FirebaseNotificationService $fcm = new FirebaseNotificationService
    ) {
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function notifyLike(User $actor, User $recipient, string $postId): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'likes')) {
            return;
        }

        $this->createAndPush(
            recipient: $recipient,
            type: 'like',
            fromHandle: (string) $actor->handle,
            message: "{$actor->handle} liked your post",
            postId: $postId,
            title: 'New like',
            body: "{$actor->handle} liked your post",
            data: [
                'type' => 'like',
                'postId' => $postId,
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    public function notifyReclip(User $actor, User $recipient, string $postId): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'reclips')) {
            return;
        }

        $title = $this->actorLabel($actor);
        $this->createAndPush(
            recipient: $recipient,
            type: 'reclip',
            fromHandle: (string) $actor->handle,
            message: "{$actor->handle} reclipped your post",
            postId: $postId,
            title: $title,
            body: 'reclipped your post',
            data: [
                'type' => 'reclip',
                'post_id' => $postId,
                'postId' => $postId,
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    public function notifyShare(User $actor, User $recipient, string $postId): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'shares')) {
            return;
        }

        $title = $this->actorLabel($actor);
        $this->createAndPush(
            recipient: $recipient,
            type: 'share',
            fromHandle: (string) $actor->handle,
            message: "{$actor->handle} shared your post",
            postId: $postId,
            title: $title,
            body: 'shared your post',
            data: [
                'type' => 'share',
                'post_id' => $postId,
                'postId' => $postId,
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function notifyComment(User $actor, User $recipient, string $postId, string $commentId, string $text): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'comments')) {
            return;
        }

        $snippet = mb_strlen($text) > 80 ? mb_substr($text, 0, 77).'…' : $text;
        $this->createAndPush(
            recipient: $recipient,
            type: 'comment',
            fromHandle: (string) $actor->handle,
            message: $snippet !== '' ? $snippet : "{$actor->handle} commented on your post",
            postId: $postId,
            commentId: $commentId,
            title: 'New comment',
            body: "{$actor->handle}: ".($snippet !== '' ? $snippet : 'commented on your post'),
            data: [
                'type' => 'comment',
                'postId' => $postId,
                'commentId' => $commentId,
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    public function notifyFollowRequest(User $actor, User $recipient): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'followRequests')) {
            return;
        }

        $this->createAndPush(
            recipient: $recipient,
            type: 'follow_request',
            fromHandle: (string) $actor->handle,
            message: "{$actor->handle} wants to follow you",
            title: 'Follow request',
            body: "{$actor->handle} wants to follow you",
            data: [
                'type' => 'follow_request',
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    public function notifyDirectMessage(User $actor, User $recipient, Message $message): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if ($message->is_system_message) {
            return;
        }
        if (! $this->prefAllows($recipient, 'directMessages')) {
            return;
        }

        $conversationId = (string) ($message->conversation_id ?? '');
        $preview = $this->directMessagePreview($message);
        try {
            $this->fcm->sendToUser((string) $recipient->id, (string) $actor->handle, $preview, [
                'type' => 'dm',
                'conversation_id' => $conversationId,
                'conversationId' => $conversationId,
                'sender_id' => (string) $actor->id,
                'senderId' => (string) $actor->id,
                'fromHandle' => (string) $actor->handle,
                'sender_handle' => (string) $actor->handle,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to dispatch FCM', [
                'type' => 'dm',
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function notifyGroupInvite(User $inviter, User $invitee, ChatGroup $group, ?string $inviteId = null): void
    {
        if ($inviter->id === $invitee->id) {
            return;
        }
        if (! $this->prefAllows($invitee, 'groupChats')) {
            return;
        }

        $groupId = (string) $group->id;
        $groupName = trim((string) ($group->name ?? '')) ?: 'Group';
        $title = $groupName;
        $body = "{$inviter->handle} invited you to join {$groupName}";

        try {
            $this->fcm->sendToUser((string) $invitee->id, $title, $body, [
                'type' => 'group_invite',
                'group_id' => $groupId,
                'chatGroupId' => $groupId,
                'chat_group_id' => $groupId,
                'invite_id' => (string) ($inviteId ?? ''),
                'chatGroupInviteId' => (string) ($inviteId ?? ''),
                'fromHandle' => (string) $inviter->handle,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to dispatch FCM', [
                'type' => 'group_invite',
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function notifyGroupMessage(User $actor, ChatGroup $group, Message $message): void
    {
        if ($message->is_system_message) {
            return;
        }

        $groupId = (string) $group->id;
        $groupName = trim((string) ($group->name ?? '')) ?: 'Group';
        $preview = $this->directMessagePreview($message);
        $title = $groupName;
        $body = $preview === 'Sent an attachment'
            ? "{$actor->handle}: {$preview}"
            : "{$actor->handle}: {$preview}";

        $memberIds = $group->activeMembers()
            ->where('user_id', '!=', $actor->id)
            ->pluck('user_id')
            ->filter()
            ->values();
        if ($memberIds->isEmpty()) {
            return;
        }

        $members = User::query()->whereIn('id', $memberIds)->get();
        foreach ($members as $member) {
            if (! $this->prefAllows($member, 'groupChats')) {
                continue;
            }
            try {
                $this->fcm->sendToUser((string) $member->id, $title, $body, [
                    'type' => 'group_chat',
                    'group_id' => $groupId,
                    'chatGroupId' => $groupId,
                    'chat_group_id' => $groupId,
                    'fromHandle' => (string) $actor->handle,
                    'sender_id' => (string) $actor->id,
                    'senderId' => (string) $actor->id,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to dispatch FCM', [
                    'type' => 'group_chat',
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    public function notifyFollow(User $actor, User $recipient): void
    {
        if ($actor->id === $recipient->id) {
            return;
        }
        if (! $this->prefAllows($recipient, 'follows')) {
            return;
        }

        $this->createAndPush(
            recipient: $recipient,
            type: 'follow',
            fromHandle: (string) $actor->handle,
            message: "{$actor->handle} started following you",
            title: 'New follower',
            body: "{$actor->handle} started following you",
            data: [
                'type' => 'follow',
                'fromHandle' => (string) $actor->handle,
            ]
        );
    }

    /**
     * @param  array<string, string>  $data
     */
    private function createAndPush(
        User $recipient,
        string $type,
        string $fromHandle,
        string $message,
        string $title,
        string $body,
        array $data,
        ?string $postId = null,
        ?string $commentId = null,
    ): void {
        try {
            Notification::create([
                'user_id' => $recipient->id,
                'type' => $type,
                'from_handle' => $fromHandle,
                'to_handle' => (string) $recipient->handle,
                'message' => $message,
                'post_id' => $postId,
                'comment_id' => $commentId,
                'read' => false,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to persist notification', [
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $this->fcm->sendToUser((string) $recipient->id, $title, $body, $data);
        } catch (\Throwable $e) {
            Log::warning('Failed to dispatch FCM', [
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function actorLabel(User $actor): string
    {
        $handle = trim((string) ($actor->handle ?? ''));
        if ($handle !== '') {
            return $handle;
        }
        $name = trim((string) ($actor->display_name ?? $actor->name ?? ''));

        return $name !== '' ? $name : 'Someone';
    }

    private function directMessagePreview(Message $message): string
    {
        $text = trim((string) ($message->text ?? ''));
        if ($text !== '') {
            return mb_strlen($text) > 120 ? mb_substr($text, 0, 117).'…' : $text;
        }

        return 'Sent an attachment';
    }

    private function prefAllows(User $recipient, string $prefKey): bool
    {
        if (! Schema::hasTable('notification_preferences')) {
            return true;
        }

        $row = DB::table('notification_preferences')
            ->where(function ($q) use ($recipient) {
                $q->where('user_id', $recipient->id)
                    ->orWhere('user_handle', $recipient->handle);
            })
            ->orderByDesc('updated_at')
            ->first();

        if (! $row) {
            return true;
        }

        $prefs = json_decode((string) ($row->preferences ?? ''), true);
        if (! is_array($prefs)) {
            return true;
        }

        if (array_key_exists('enabled', $prefs) && $prefs['enabled'] === false) {
            return false;
        }

        if (array_key_exists($prefKey, $prefs)) {
            return (bool) $prefs[$prefKey];
        }

        return true;
    }
}
