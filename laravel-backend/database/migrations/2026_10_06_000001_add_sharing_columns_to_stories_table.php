<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * These columns were historically applied to env databases out-of-band, so a fresh
 * `migrate:fresh` (and every RefreshDatabase feature test) built a `stories` table
 * WITHOUT them. Writing `audience`/`video_poster_url` then threw, the API returned 500,
 * and the client silently fell back to the in-memory mock — the shared story vanished.
 * Guarded so it is a no-op on databases that already have the columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            if (!Schema::hasColumn('stories', 'link_preview')) {
                $table->text('link_preview')->nullable();
            }
            if (!Schema::hasColumn('stories', 'audience')) {
                $table->string('audience')->default('public')->index();
            }
            if (!Schema::hasColumn('stories', 'tagged_users_positions')) {
                $table->text('tagged_users_positions')->nullable();
            }
            if (!Schema::hasColumn('stories', 'video_poster_url')) {
                $table->string('video_poster_url', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            foreach (['link_preview', 'audience', 'tagged_users_positions', 'video_poster_url'] as $column) {
                if (Schema::hasColumn('stories', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};