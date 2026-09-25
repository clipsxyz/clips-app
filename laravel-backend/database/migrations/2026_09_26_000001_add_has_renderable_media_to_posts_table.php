<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stores whether a post has media the feed can actually render.
 *
 * Mirrors isLinkShareFeedPost() on the client: a post is "renderable" when
 * media_url is a non-empty string, or at least one media_items entry has a
 * non-empty url. A post that carries a link_preview but no renderable media is
 * a text-only share card — those belong in Stories 24, not the news feed.
 *
 * Filtering this in SQL (rather than stripping in the client) keeps every feed
 * page full: the client used to receive 16 raw posts, discard the link-share
 * ones, and then walk the cursor forward page by page when a whole page was
 * discarded — which stalled the National tab for seconds and, once the walk
 * budget ran out, ended pagination for good.
 *
 * Defaults to 1 so an un-backfilled row is treated as renderable. Guessing
 * "renderable" can only ever show a post; guessing "link share" would hide one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('posts', 'has_renderable_media')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->boolean('has_renderable_media')->default(true)->after('link_preview');
            });
        }

        // Featured in feed listings, which are always bounded by is_reclipped.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            Schema::table('posts', function (Blueprint $table) {
                $table->index(['is_reclipped', 'has_renderable_media', 'created_at', 'id'], 'posts_feed_renderable_cursor_idx');
            });
        } else {
            Schema::table('posts', function (Blueprint $table) {
                $table->index(['is_reclipped', 'has_renderable_media', 'created_at'], 'posts_feed_renderable_cursor_idx');
            });
        }

        $this->backfill();
    }

    public function down(): void
    {
        if (!Schema::hasColumn('posts', 'has_renderable_media')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropIndex('posts_feed_renderable_cursor_idx');
            });
        } else {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropIndex('posts_feed_renderable_cursor_idx');
            });
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('has_renderable_media');
        });
    }

    /**
     * Recompute the flag for every post. media_items is JSON, so the predicate
     * is evaluated in PHP rather than per-driver JSON SQL.
     */
    private function backfill(): void
    {
        DB::table('posts')
            ->select(['id', 'media_url', 'media_items'])
            ->orderBy('id')
            ->chunk(500, function ($posts): void {
                $updates = [];
                foreach ($posts as $post) {
                    $updates[] = [
                        'id' => $post->id,
                        'has_renderable_media' => $this->renderable($post->media_url, $post->media_items) ? 1 : 0,
                    ];
                }

                foreach ($updates as $update) {
                    DB::table('posts')
                        ->where('id', $update['id'])
                        ->update(['has_renderable_media' => $update['has_renderable_media']]);
                }
            });
    }

    private function renderable($mediaUrl, $rawMediaItems): bool
    {
        if (is_string($mediaUrl) && trim($mediaUrl) !== '') {
            return true;
        }

        $items = is_string($rawMediaItems) ? json_decode($rawMediaItems, true) : $rawMediaItems;
        if (!is_array($items)) {
            return false;
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $url = $item['url'] ?? null;
            if (is_string($url) && trim($url) !== '') {
                return true;
            }
        }

        return false;
    }
};
