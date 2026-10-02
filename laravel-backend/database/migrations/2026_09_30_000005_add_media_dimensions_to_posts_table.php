<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores intrinsic media dimensions on the post record.
 *
 * WHY
 * ---
 * The feed could not size a card correctly without downloading the video: every card was
 * laid out from a fixed 4:5 / 16:9 token chosen before decode, then the player discovered
 * the real orientation from `naturalSize` after mount and shrank inside a box that stayed
 * at the token height. The surplus rendered as black bars (see
 * `src/components/FeedPageLayout.native.tsx`, FEED_CARD_MEDIA_WRAP backgroundColor
 * #000000). Shipping the dimensions with the post lets the client lay the card out at its
 * final height on first paint, which both removes the bars and eliminates the layout
 * shift when `onLoad` fires.
 *
 * All three columns are NULLABLE and there is no backfill. Existing posts keep NULL and
 * the client falls back to measuring `naturalSize` at runtime, so this migration cannot
 * fail on a large table and cannot reject any existing row.
 *
 * `aspect_ratio` is a convenience copy (width / height). It is redundant with the two
 * integers and is deliberately NOT the source of truth -- the client trusts
 * `width`/`height` when present and only uses `aspect_ratio` if the integers are missing.
 * It exists because the value is needed on nearly every card and shipping it avoids a
 * division in the hot feed path.
 *
 * Precision: decimal(10,6) holds ratios like 0.562500 and 1.333333 exactly enough for
 * layout maths. A float/double column would invite drift between engines; an integer
 * basis-points column would cap out at 0.01 granularity, which is too coarse for
 * distinguishing 4:5 from 9:16.
 *
 * Guarded with hasColumn() because this working tree, `main`, and the live dev SQLite
 * database do not have identical `posts` columns, so the migration must be safe against
 * whichever is current. Same convention as 2026_08_18_000001.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'width')) {
                // Intrinsic pixel width of the primary media, from container metadata.
                $table->unsignedInteger('width')->nullable()->after('media_type');
            }

            if (! Schema::hasColumn('posts', 'height')) {
                $table->unsignedInteger('height')->nullable()->after('width');
            }

            if (! Schema::hasColumn('posts', 'aspect_ratio')) {
                $table->decimal('aspect_ratio', 10, 6)->nullable()->after('height');
            }
        });

        // Index for "posts at this orientation", which is what a feed filter eventually
        // wants. Skipped on SQLite, which has no useful partial index story here.
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('posts', function (Blueprint $table) {
                if (Schema::hasColumn('posts', 'width') && Schema::hasColumn('posts', 'height')) {
                    $table->index(['width', 'height'], 'posts_width_height_index');
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts') || ! Schema::hasColumn('posts', 'aspect_ratio')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            if (Schema::getConnection()->getDriverName() !== 'sqlite') {
                $table->dropIndex('posts_width_height_index');
            }

            $table->dropColumn(['width', 'height', 'aspect_ratio']);
        });
    }
};
