<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `posts.link_preview` was historically applied to env databases out-of-band, so a fresh
 * `migrate:fresh` (and every RefreshDatabase feature test) built a `posts` table WITHOUT it.
 * Writing link_preview then threw a QueryException, the API returned 500, and the composer's
 * preview was silently dropped. Guarded so it is a no-op on databases that already have the
 * column (mirrors the stories equivalent).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'link_preview')) {
                $table->text('link_preview')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'link_preview')) {
                $table->dropColumn('link_preview');
            }
        });
    }
};
