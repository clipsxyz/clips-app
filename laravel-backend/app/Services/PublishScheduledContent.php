<?php

namespace App\Services;

use App\Models\Post;
use App\Models\Story;
use App\Models\User;

class PublishScheduledContent
{
    /**
     * Flip overdue scheduled posts and Shorts to published.
     * created_at is the scheduled time, so they enter the feed as posted then.
     *
     * @return array{posts: int, shorts: int}
     */
    public function publishDue(): array
    {
        return [
            'posts' => $this->publishDuePosts(),
            'shorts' => $this->publishDueShorts(),
        ];
    }

    private function publishDuePosts(): int
    {
        $due = Post::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->exists();
        if (! $due) {
            return 0;
        }

        $published = 0;
        Post::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->orderBy('id')
            ->each(function (Post $post) use (&$published) {
                $when = $post->scheduled_at;
                if ($when === null) {
                    return;
                }

                $updated = Post::query()
                    ->whereKey($post->id)
                    ->where('status', 'scheduled')
                    ->update([
                        'status' => 'published',
                        'created_at' => $when,
                    ]);

                if ($updated !== 1) {
                    return;
                }

                User::query()->whereKey($post->user_id)->increment('posts_count');
                $published++;
            });

        return $published;
    }

    private function publishDueShorts(): int
    {
        $due = Story::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->exists();
        if (! $due) {
            return 0;
        }

        $published = 0;
        Story::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->orderBy('id')
            ->each(function (Story $story) use (&$published) {
                $when = $story->scheduled_at;
                if ($when === null) {
                    return;
                }

                $updated = Story::query()
                    ->whereKey($story->id)
                    ->where('status', 'scheduled')
                    ->update([
                        'status' => 'published',
                        'created_at' => $when,
                        'expires_at' => $when->copy()->addHours(24),
                    ]);

                if ($updated !== 1) {
                    return;
                }

                StoryService::forgetRailCacheForUser((string) $story->user_id);
                $published++;
            });

        return $published;
    }
}
