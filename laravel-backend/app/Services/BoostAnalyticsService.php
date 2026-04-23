<?php

namespace App\Services;

use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Message;
use App\Models\Post;

class BoostAnalyticsService
{
    /**
     * Increment an analytics metric for the active boost on a post.
     * Returns true when a matching active boost is found and updated.
     */
    public static function incrementForPost(string $postId, string $metric, int $by = 1): bool
    {
        if ($by <= 0) {
            return false;
        }

        $allowed = ['impressions_count', 'likes_count', 'comments_count', 'shares_count'];
        if (!in_array($metric, $allowed, true)) {
            return false;
        }

        $boost = Boost::where('post_id', $postId)
            ->active()
            ->orderByDesc('activated_at')
            ->first();

        if (!$boost) {
            return false;
        }

        $boost->increment($metric, $by);
        $boost->last_analytics_event_at = now();
        $boost->save();

        $eventType = match ($metric) {
            'impressions_count' => 'impression',
            'likes_count' => 'like',
            'comments_count' => 'comment',
            'shares_count' => 'share',
            default => null,
        };

        if ($eventType) {
            for ($i = 0; $i < $by; $i++) {
                self::recordEvent($boost->id, $boost->post_id, $eventType, null, 'counter_increment');
            }
        }

        return true;
    }

    /**
     * Record a profile visit against the most recent active boost of the profile owner.
     */
    public static function recordProfileVisitForUser(string $profileOwnerUserId, ?string $actorUserId, ?string $sourcePostId = null): bool
    {
        if ($actorUserId && $profileOwnerUserId === $actorUserId) {
            return false;
        }

        $boost = null;
        $usedSourceContext = false;
        if ($sourcePostId) {
            $boost = Boost::where('post_id', $sourcePostId)
                ->where('user_id', $profileOwnerUserId)
                ->active()
                ->orderByDesc('activated_at')
                ->first();
            $usedSourceContext = $boost !== null;
        }
        if (!$boost) {
            $boost = Boost::where('user_id', $profileOwnerUserId)
                ->active()
                ->orderByDesc('activated_at')
                ->first();
        }

        if (!$boost) {
            return false;
        }

        self::recordEvent(
            $boost->id,
            $boost->post_id,
            'profile_visit',
            $actorUserId,
            $usedSourceContext ? 'source_post' : 'fallback_active_boost'
        );
        return true;
    }

    /**
     * Record a "message start" when sender starts a DM with recipient for first time in a conversation.
     */
    public static function recordMessageStartForConversation(string $senderHandle, string $recipientHandle, ?string $sourcePostId = null): bool
    {
        $conversationId = Message::getConversationId($senderHandle, $recipientHandle);
        $alreadyHasMessages = Message::where('conversation_id', $conversationId)->exists();
        if ($alreadyHasMessages) {
            return false;
        }

        $recipientBoost = null;
        $usedSourceContext = false;
        if ($sourcePostId) {
            $post = Post::where('id', $sourcePostId)->where('user_handle', $recipientHandle)->first();
            if ($post) {
                $recipientBoost = Boost::where('post_id', $post->id)
                    ->active()
                    ->orderByDesc('activated_at')
                    ->first();
                $usedSourceContext = $recipientBoost !== null;
            }
        }
        if (!$recipientBoost) {
            $recipientBoost = Boost::whereHas('user', function ($q) use ($recipientHandle) {
                $q->where('handle', $recipientHandle);
            })
                ->active()
                ->orderByDesc('activated_at')
                ->first();
        }

        if (!$recipientBoost) {
            return false;
        }

        self::recordEvent(
            $recipientBoost->id,
            $recipientBoost->post_id,
            'message_start',
            null,
            $usedSourceContext ? 'source_post' : 'fallback_active_boost'
        );
        return true;
    }

    private static function recordEvent(int $boostId, string $postId, string $eventType, ?string $actorUserId, ?string $attributionContext = null): void
    {
        BoostAnalyticsEvent::create([
            'boost_id' => $boostId,
            'post_id' => $postId,
            'actor_user_id' => $actorUserId,
            'event_type' => $eventType,
            'attribution_context' => $attributionContext,
        ]);

        Boost::where('id', $boostId)->update([
            'last_analytics_event_at' => now(),
        ]);
    }
}

