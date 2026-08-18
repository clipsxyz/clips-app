<?php

namespace App\Services;

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
