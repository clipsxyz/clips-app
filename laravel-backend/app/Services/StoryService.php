<?php

namespace App\Services;

use App\Models\Story;
use App\Models\User;
use App\Support\LocationHierarchy;
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
     * Active 24h stories: followed authors OR authors matching the active location feed.
     */
    public function getStoriesRail(?User $viewer, ?string $userIdParam = null, ?string $filter = null): Builder
    {
        $query = Story::query()
            ->active()
            ->where('created_at', '>=', now()->subHours(24));

        $this->applyRailScope($query, $viewer, $userIdParam, $filter);

        return $query;
    }

    public function applyRailScope(Builder $query, ?User $viewer, ?string $userIdParam, ?string $filter): void
    {
        $authorIds = $this->storyFeedAuthorIds($viewer, $userIdParam);
        $locationFilter = $this->normalizedLocationFilter($filter);

        $query->where(function (Builder $scoped) use ($authorIds, $locationFilter) {
            $hasFollowed = $authorIds->isNotEmpty();
            $hasLocation = $locationFilter !== null;

            if ($hasFollowed) {
                $scoped->whereIn('user_id', $authorIds->all());
            }

            if ($hasLocation) {
                $this->orApplyLocationMatch($scoped, $locationFilter);
            }

            if (!$hasFollowed && !$hasLocation) {
                $scoped->whereRaw('0 = 1');
            }
        });
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

    private function normalizedLocationFilter(?string $filter): ?string
    {
        $raw = trim((string) $filter);
        if ($raw === '') {
            return null;
        }

        $lower = strtolower($raw);
        if (in_array($lower, ['following', 'discover', 'nearby'], true)) {
            return null;
        }

        return $raw;
    }

    private function orApplyLocationMatch(Builder $query, string $filter): void
    {
        $lower = strtolower($filter);

        if (str_starts_with($lower, 'venue:')) {
            $venue = trim(substr($filter, 6));
            if ($venue === '') {
                return;
            }
            $query->orWhere(function (Builder $q) use ($venue) {
                $q->where('venue', 'LIKE', "%{$venue}%")
                    ->orWhere('location', 'LIKE', "%{$venue}%");
            });

            return;
        }

        if (str_starts_with($lower, 'landmark:')) {
            $landmark = trim(substr($filter, 9));
            if ($landmark === '') {
                return;
            }
            $query->orWhere(function (Builder $q) use ($landmark) {
                $q->where('location', 'LIKE', "%{$landmark}%")
                    ->orWhere('venue', 'LIKE', "%{$landmark}%");
            });

            return;
        }

        $query->orWhereHas('user', function ($uq) use ($filter) {
            $this->applyAuthorProfileLocation($uq, $filter);
        });
    }

    private function applyAuthorProfileLocation($query, string $filter): void
    {
        $needle = trim($filter);
        if ($needle === '') {
            return;
        }

        if (LocationHierarchy::isCountry($needle)) {
            $aliases = LocationHierarchy::countryAliases($needle);
            $cities = LocationHierarchy::citiesForCountry($needle);
            $query->where(function ($profile) use ($aliases, $cities) {
                foreach ($aliases as $alias) {
                    $profile->orWhere('location_national', 'LIKE', "%{$alias}%")
                        ->orWhere('location_regional', 'LIKE', "%{$alias}%")
                        ->orWhere('location_local', 'LIKE', "%{$alias}%");
                }
                foreach ($cities as $city) {
                    $profile->orWhere('location_local', 'LIKE', "%{$city}%")
                        ->orWhere('location_regional', 'LIKE', "%{$city}%");
                }
            });

            return;
        }

        $query->where(function ($profile) use ($needle) {
            $profile->where('location_local', 'LIKE', "%{$needle}%")
                ->orWhere('location_regional', 'LIKE', "%{$needle}%");
        });
    }
}
