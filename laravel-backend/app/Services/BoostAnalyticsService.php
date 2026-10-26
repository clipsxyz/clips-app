<?php

namespace App\Services;

use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Message;
use App\Models\Post;
use App\Models\ProfileVisitEvent;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

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
     * Record a profile visit. Always stored for the owner (organic), and also
     * attributed to an active boost when one exists.
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

        $attribution = $boost
            ? ($usedSourceContext ? 'source_post' : 'fallback_active_boost')
            : 'organic';

        $alreadyToday = false;
        if ($actorUserId && self::profileVisitTableReady()) {
            try {
                $alreadyToday = ProfileVisitEvent::query()
                    ->where('profile_user_id', $profileOwnerUserId)
                    ->where('actor_user_id', $actorUserId)
                    ->where('created_at', '>=', now()->startOfDay())
                    ->exists();
            } catch (Throwable $e) {
                Log::warning('profile_visit_events lookup skipped', ['error' => $e->getMessage()]);
                $alreadyToday = false;
            }
        }

        if (!$alreadyToday && self::profileVisitTableReady()) {
            try {
                ProfileVisitEvent::create([
                    'profile_user_id' => $profileOwnerUserId,
                    'actor_user_id' => $actorUserId,
                    'source_post_id' => $sourcePostId ?: null,
                    'boost_id' => $boost?->id,
                    'attribution_context' => $attribution,
                ]);
            } catch (Throwable $e) {
                Log::warning('profile_visit_events insert skipped', ['error' => $e->getMessage()]);
            }
        }

        if ($boost) {
            self::recordEvent(
                $boost->id,
                $boost->post_id,
                'profile_visit',
                $actorUserId,
                $attribution
            );
        }

        return !$alreadyToday || $boost !== null;
    }

    public static function profileVisitCountForUser(string $profileOwnerUserId, $fromTs = null): int
    {
        if (!self::profileVisitTableReady()) {
            return 0;
        }

        try {
            $query = ProfileVisitEvent::query()->where('profile_user_id', $profileOwnerUserId);
            if ($fromTs) {
                $query->where('created_at', '>=', $fromTs);
            }

            return (int) $query->count();
        } catch (Throwable $e) {
            Log::warning('profile_visit_events count skipped', ['error' => $e->getMessage()]);

            return 0;
        }
    }

    private static function profileVisitTableReady(): bool
    {
        try {
            return Schema::hasTable('profile_visit_events');
        } catch (Throwable $e) {
            return false;
        }
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

