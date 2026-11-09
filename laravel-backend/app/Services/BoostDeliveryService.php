<?php

namespace App\Services;

use App\Http\Controllers\Api\PostController;
use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\FeedContentPreference;
use App\Models\Story;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Paid slots are a separate list from organic ranking.
 * The winner is the active boost furthest behind the audience it already paid for.
 */
class BoostDeliveryService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function candidates(User $viewer, string $surface, ?string $feedType): array
    {
        $prefs = FeedContentPreference::query()->where('user_id', $viewer->id)->first();
        $blocked = $this->handleSet(array_merge(
            $prefs->blocked_handles ?? [],
            $prefs->muted_handles ?? [],
        ));
        $hiddenPosts = array_fill_keys(array_map('strval', array_merge(
            $prefs->hidden_post_ids ?? [],
            $prefs->not_interested_post_ids ?? [],
        )), true);

        $boosts = Boost::query()
            ->active()
            ->with(['user', 'post.user'])
            ->get()
            ->filter(function (Boost $boost) use ($viewer, $surface, $feedType, $blocked, $hiddenPosts) {
                if ((string) $boost->user_id === (string) $viewer->id) {
                    return false;
                }
                if ($surface === 'location' && (string) $boost->feed_type !== (string) $feedType) {
                    return false;
                }
                $owner = $boost->user;
                $post = $boost->post;
                if (! $owner || ! $post) {
                    return false;
                }
                if (! $this->viewerInPaidArea($viewer, $owner, (string) $boost->feed_type)) {
                    return false;
                }
                $handle = $this->normalizeHandle((string) ($owner->handle ?? $post->user_handle ?? ''));
                if ($handle !== '' && isset($blocked[$handle])) {
                    return false;
                }
                if (isset($hiddenPosts[(string) $post->id])) {
                    return false;
                }

                return true;
            })
            ->values();

        if ($boosts->isEmpty()) {
            return [];
        }

        $ids = $boosts->pluck('id')->all();
        $reachRows = BoostAnalyticsEvent::query()
            ->whereIn('boost_id', $ids)
            ->where('event_type', 'reach')
            ->whereNotNull('actor_user_id')
            ->select(['boost_id', 'actor_user_id'])
            ->distinct()
            ->get();

        $reachedByBoost = [];
        $seenByViewer = [];
        foreach ($reachRows as $row) {
            $boostId = (int) $row->boost_id;
            $actor = (string) $row->actor_user_id;
            $reachedByBoost[$boostId][$actor] = true;
            if ($actor === (string) $viewer->id) {
                $seenByViewer[$boostId] = true;
            }
        }

        $audienceCache = [];
        $ranked = [];
        foreach ($boosts as $boost) {
            if (isset($seenByViewer[(int) $boost->id])) {
                continue;
            }
            $owner = $boost->user;
            $cacheKey = $owner->id.'|'.$boost->feed_type;
            if (! array_key_exists($cacheKey, $audienceCache)) {
                $audienceCache[$cacheKey] = $this->realAudienceCount($owner, (string) $boost->feed_type);
            }
            $audience = $audienceCache[$cacheKey];
            if ($audience < 1) {
                continue;
            }

            $paceGap = $this->paceGap($boost, count($reachedByBoost[(int) $boost->id] ?? []), $audience);
            $story = $surface === 'stories' ? $this->publicStory($owner) : null;
            if ($surface === 'stories' && $story === null) {
                continue;
            }

            $post = PostController::toApiArray($boost->post, $viewer);
            $ranked[] = [
                'boostId' => (int) $boost->id,
                'postId' => (string) $boost->post_id,
                'feedType' => (string) $boost->feed_type,
                'paceGap' => $paceGap,
                'quality' => 1,
                'post' => $post,
                'story' => $story,
            ];
        }

        usort($ranked, fn (array $a, array $b) => $b['paceGap'] <=> $a['paceGap']);

        return array_slice($ranked, 0, 8);
    }

    public function paceGap(Boost $boost, int $peopleReached, int $audience): float
    {
        $start = $boost->activated_at instanceof Carbon
            ? $boost->activated_at->getTimestamp()
            : now()->getTimestamp();
        $durationHours = max(0, (int) ($boost->duration_hours ?? 0));
        $end = $boost->expires_at instanceof Carbon
            ? $boost->expires_at->getTimestamp()
            : $start + ($durationHours * 3600);
        $duration = max(1, $end - $start);
        $elapsed = min($duration, max(0, now()->getTimestamp() - $start));
        $owed = max(1, $audience);

        return round(($elapsed / $duration) - ($peopleReached / $owed), 4);
    }

    private function viewerInPaidArea(User $viewer, User $owner, string $feedType): bool
    {
        $column = $this->areaColumn($feedType);
        if ($column === null) {
            return false;
        }
        $viewerArea = mb_strtolower(trim((string) ($viewer->{$column} ?? '')));
        $ownerArea = mb_strtolower(trim((string) ($owner->{$column} ?? '')));

        return $viewerArea !== '' && $viewerArea === $ownerArea;
    }

    private function realAudienceCount(User $owner, string $feedType): int
    {
        $column = $this->areaColumn($feedType);
        $area = mb_strtolower(trim((string) ($owner->{$column} ?? '')));
        if ($column === null || $area === '') {
            return 0;
        }

        return (int) User::query()
            ->where('id', '!=', $owner->id)
            ->whereRaw('LOWER('.$column.') = ?', [$area])
            ->count();
    }

    private function areaColumn(string $feedType): ?string
    {
        return match ($feedType) {
            'local' => 'location_local',
            'regional' => 'location_regional',
            'national' => 'location_national',
            default => null,
        };
    }

    /**
     * @param  list<mixed>  $handles
     * @return array<string, true>
     */
    private function handleSet(array $handles): array
    {
        $set = [];
        foreach ($handles as $handle) {
            $normalized = $this->normalizeHandle((string) $handle);
            if ($normalized !== '') {
                $set[$normalized] = true;
            }
        }

        return $set;
    }

    private function normalizeHandle(string $handle): string
    {
        return mb_strtolower(ltrim(trim($handle), '@'));
    }

    /**
     * @return array{id: string, handle: string, title: string, thumb: ?string, avatarUrl: ?string}|null
     */
    private function publicStory(User $owner): ?array
    {
        $story = Story::query()
            ->active()
            ->where('user_id', $owner->id)
            ->where(function ($query) {
                $query->whereNull('audience')->orWhere('audience', 'public');
            })
            ->orderByDesc('created_at')
            ->first();
        if (! $story) {
            return null;
        }

        $thumb = trim((string) ($story->video_poster_url ?: ''));
        if ($thumb === '' && (string) $story->media_type === 'image') {
            $thumb = trim((string) ($story->media_url ?: ''));
        }
        $title = trim((string) ($story->text ?: $owner->handle ?: 'Sponsored'));

        return [
            'id' => (string) $story->id,
            'handle' => (string) ($story->user_handle ?: $owner->handle),
            'title' => mb_strlen($title) > 34 ? mb_substr($title, 0, 34).'...' : $title,
            'thumb' => $thumb !== '' ? $thumb : null,
            'avatarUrl' => $owner->avatar_url ? (string) $owner->avatar_url : null,
        ];
    }
}
