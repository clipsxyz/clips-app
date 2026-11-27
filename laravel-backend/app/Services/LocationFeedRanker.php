<?php

namespace App\Services;

use App\Models\Post;
use Carbon\Carbon;

/**
 * Scores a location-scoped candidate. Seen memory is the existing post_views
 * row (user_id + post_id, created_at is when it was marked seen).
 */
class LocationFeedRanker
{
    public const WINDOW_DAYS = 5;

    public const UNSEEN_MULTIPLIER = 2.5;

    public const SEEN_MULTIPLIER = 1.0;

    public const FOLLOW_MULTIPLIER = 1.25;

    /** Active boosts stay ahead of an otherwise equal local post. */
    public const BOOST_MULTIPLIER = 2.0;

    public const RANK_SCALE = 1000000;

    public function rankKey(Post $post, bool $seen, bool $followed, ?int $at = null): int
    {
        $likes = (int) ($post->likes_count ?? 0);
        $comments = (int) ($post->comments_count ?? 0);
        $saves = (int) ($post->saves_rel_count ?? 0);
        $views = (int) ($post->views_count ?? 0);
        $createdAt = $post->created_at instanceof Carbon
            ? $post->created_at
            : Carbon::parse((string) $post->created_at);
        $at = $at ?? now()->getTimestamp();
        $hours = max(0, ($at - $createdAt->getTimestamp()) / 3600);
        // Engagement outweighs age so a busy post from the last few days
        // stays above a new post that nobody has touched.
        $base = (1 + (4 * $likes) + (6 * $comments) + (4 * $saves) + (0.2 * $views))
            / (($hours + 2) ** 0.55);

        $multiplier = $seen ? self::SEEN_MULTIPLIER : self::UNSEEN_MULTIPLIER;
        if ($followed) {
            $multiplier *= self::FOLLOW_MULTIPLIER;
        }
        if ($this->isActivelyBoosted($post, $at)) {
            $multiplier *= self::BOOST_MULTIPLIER;
        }

        return (int) round($base * $multiplier * self::RANK_SCALE);
    }

    public function isActivelyBoosted(Post $post, ?int $at = null): bool
    {
        if (! $post->is_boosted || ! $post->boosted_until) {
            return false;
        }

        $until = $post->boosted_until instanceof Carbon
            ? $post->boosted_until
            : Carbon::parse((string) $post->boosted_until);

        return $until->getTimestamp() > ($at ?? now()->getTimestamp());
    }
}
