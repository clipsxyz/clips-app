<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores a sampled dominant colour on the post record.
 *
 * WHY
 * ---
 * The feed draws a fixed ambient canvas behind its floating cards and tints it toward the
 * colour of the post in focus. That colour was meant to be sampled on device, but
 * `react-native-image-colors` is an Expo module (`ImageColorsModule : Module()`) that ships
 * no ReactPackage, so React Native autolinking skips it in this bare RN app and the native
 * call is simply absent at runtime -- the canvas stayed pinned to its fallback. It also
 * hard-depends on a `:expo-modules-core` Gradle project this app does not have.
 *
 * Sampling the poster JPEG in Laravel instead costs the client nothing, cannot jank a
 * scroll, and returns the same colour on iOS and Android rather than two different native
 * results (Android yields `dominant`, iOS yields `primary` and has no `dominant` at all).
 * See `App\Support\DominantColor`.
 *
 * Nullable and unindexed: a post may legitimately have no sample (text-only posts, media
 * whose file is gone), and nothing ever queries by colour -- it is read only alongside a
 * post the feed already fetched. Indexing it would cost write throughput for no query.
 *
 * Length 7 holds `#RRGGBB` exactly. No index, and no backfill in the migration itself:
 * `posts:backfill-dominant-color` samples existing rows, so this cannot fail on a large
 * table and cannot reject an existing row.
 *
 * Guarded with hasColumn() because this working tree, `main`, and the live dev SQLite
 * database do not have identical `posts` columns. Same convention as
 * 2026_09_30_000005.
 *
 * No `->after()` here: that clause is MySQL-only and would fail on a schema where the
 * neighbouring column is absent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        if (! Schema::hasColumn('posts', 'dominant_color')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('dominant_color', 7)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts') || ! Schema::hasColumn('posts', 'dominant_color')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('dominant_color');
        });
    }
};