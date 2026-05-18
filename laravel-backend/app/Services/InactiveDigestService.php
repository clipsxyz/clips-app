<?php

namespace App\Services;

use App\Models\EngagementEmailLog;
use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class InactiveDigestService
{
    /**
     * @return array{
     *   regional_label: string,
     *   area_post_count: int,
     *   following_post_count: int,
     *   unread_notification_count: int,
     *   sample_handles: string[],
     *   highlights: array<int, array{handle: string, excerpt: string}>
     * }|null
     */
    public function buildDigestForUser(User $user): ?array
    {
        $since = $user->last_active_at ?? $user->created_at ?? now()->subDays(30);
        if ($since instanceof Carbon === false) {
            $since = Carbon::parse($since);
        }

        $regional = trim((string) $user->location_regional);
        $regionalLabel = $regional !== '' ? $regional : 'your area';

        $areaQuery = Post::query()
            ->notReclipped()
            ->where('created_at', '>', $since)
            ->where('user_id', '!=', $user->id);

        if ($regional !== '') {
            $areaQuery->where(function ($q) use ($regional) {
                $q->whereHas('user', function ($uq) use ($regional) {
                    $uq->where('location_regional', $regional)
                        ->orWhere('location_local', 'LIKE', '%' . $regional . '%');
                })->orWhere('location_label', 'LIKE', '%' . $regional . '%');
            });
        }

        $areaPostCount = (int) (clone $areaQuery)->count();

        $followingPostCount = (int) Post::query()
            ->notReclipped()
            ->following($user->id)
            ->where('created_at', '>', $since)
            ->where('user_id', '!=', $user->id)
            ->count();

        $unreadNotificationCount = (int) Notification::query()
            ->forUser($user->id)
            ->unread()
            ->where('created_at', '>', $since)
            ->count();

        if ($areaPostCount === 0 && $followingPostCount === 0 && $unreadNotificationCount === 0) {
            return null;
        }

        $samplePosts = $this->samplePosts($user, $since, $regional);
        $sampleHandles = $samplePosts
            ->pluck('user_handle')
            ->filter()
            ->unique()
            ->take(4)
            ->values()
            ->all();

        $highlights = $samplePosts->map(function (Post $post) {
            $text = trim((string) ($post->text_content ?: $post->caption ?: ''));
            if ($text === '') {
                $text = 'Shared a new post';
            }
            if (mb_strlen($text) > 120) {
                $text = mb_substr($text, 0, 117) . '…';
            }

            return [
                'handle' => (string) ($post->user_handle ?: 'Someone'),
                'excerpt' => $text,
            ];
        })->values()->all();

        return [
            'regional_label' => $regionalLabel,
            'area_post_count' => $areaPostCount,
            'following_post_count' => $followingPostCount,
            'unread_notification_count' => $unreadNotificationCount,
            'sample_handles' => $sampleHandles,
            'highlights' => $highlights,
        ];
    }

    public function recentlySentDigest(User $user, ?int $cooldownHours = null): bool
    {
        $hours = $cooldownHours ?? (int) config('engagement.digest_cooldown_hours', 48);
        $cutoff = now()->subHours($hours);

        return EngagementEmailLog::query()
            ->where('user_id', $user->id)
            ->where('type', 'inactive_digest')
            ->where('sent_at', '>=', $cutoff)
            ->exists();
    }

    public function logSent(User $user, array $payload): void
    {
        EngagementEmailLog::create([
            'user_id' => $user->id,
            'type' => 'inactive_digest',
            'payload' => $payload,
            'sent_at' => now(),
        ]);
    }

    /**
     * @return Collection<int, Post>
     */
    private function samplePosts(User $user, Carbon $since, string $regional): Collection
    {
        $limit = (int) config('engagement.max_posts_in_email', 5);

        $following = Post::query()
            ->notReclipped()
            ->following($user->id)
            ->where('created_at', '>', $since)
            ->where('user_id', '!=', $user->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get(['id', 'user_handle', 'text_content', 'caption', 'created_at']);

        if ($following->count() >= $limit) {
            return $following;
        }

        $area = Post::query()
            ->notReclipped()
            ->where('created_at', '>', $since)
            ->where('user_id', '!=', $user->id)
            ->when($regional !== '', function ($q) use ($regional) {
                $q->where(function ($inner) use ($regional) {
                    $inner->whereHas('user', function ($uq) use ($regional) {
                        $uq->where('location_regional', $regional)
                            ->orWhere('location_local', 'LIKE', '%' . $regional . '%');
                    })->orWhere('location_label', 'LIKE', '%' . $regional . '%');
                });
            })
            ->orderByDesc('created_at')
            ->limit($limit - $following->count())
            ->get(['id', 'user_handle', 'text_content', 'caption', 'created_at']);

        return $following->concat($area)->take($limit);
    }
}
