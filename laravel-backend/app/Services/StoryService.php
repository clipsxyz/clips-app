<?php

namespace App\Services;

use App\Models\Story;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class StoryService
{
    /**
     * Accepted follows for the viewer, read from user_follows (not Eloquent pivot helpers).
     *
     * @return list<string>
     */
    public function acceptedFollowingIds(string $viewerId): array
    {
        if ($viewerId === '') {
            return [];
        }

        return DB::table('user_follows')
            ->where('follower_id', $viewerId)
            ->where('status', 'accepted')
            ->pluck('following_id')
            ->map(fn ($id) => (string) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Self + accepted following IDs (Stories 24 authors that always appear).
     *
     * @return Collection<int, string>
     */
    public function storyFeedAuthorIds(?User $viewer, ?string $userIdParam = null): Collection
    {
        $viewerId = $viewer?->id ?: $userIdParam;
        if (!$viewerId) {
            return collect();
        }

        return collect([(string) $viewerId])
            ->merge($this->acceptedFollowingIds((string) $viewerId))
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * Active 24h stories from the viewer and accepted follows only.
     * Location / Discover feed filters must not add extra authors to this rail.
     */
    public function getStoriesRail(?User $viewer, ?string $userIdParam = null): Builder
    {
        $query = Story::query()
            ->active()
            ->where('created_at', '>=', now()->subHours(24));

        $this->applyRailScope($query, $viewer, $userIdParam);

        return $query;
    }

    public function applyRailScope(Builder $query, ?User $viewer, ?string $userIdParam): void
    {
        $authorIds = $this->storyFeedAuthorIds($viewer, $userIdParam);
        if ($authorIds->isEmpty()) {
            $query->whereRaw('0 = 1');

            return;
        }

        $query->whereIn('user_id', $authorIds->all());
    }

    public static function forgetRailCacheForUser(?string $userId): void
    {
        $id = trim((string) $userId);
        if ($id === '') {
            return;
        }

        Cache::forget('stories_rail:'.$id);
        Cache::forget('stories_paged:'.$id);
        Cache::forget('stories_index:'.$id);
        Cache::increment('stories_rail_ver:'.$id);
    }
}
