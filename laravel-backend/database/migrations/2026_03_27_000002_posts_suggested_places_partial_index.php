<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL / SQLite: partial index for suggested-by-places scan (active, non-reclip posts by recency).
 * Replaces the generic (is_reclipped, created_at) btree on those drivers to avoid duplicate write cost.
 *
 * MySQL / MariaDB: no partial indexes — leaves posts_is_reclipped_created_at_index from the prior migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropIndex('posts_is_reclipped_created_at_index');
            });

            DB::statement('
                CREATE INDEX posts_suggested_places_candidates_idx
                ON posts (created_at DESC)
                WHERE deleted_at IS NULL AND is_reclipped = false
            ');

            return;
        }

        if ($driver === 'sqlite') {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropIndex('posts_is_reclipped_created_at_index');
            });

            DB::statement('
                CREATE INDEX posts_suggested_places_candidates_idx
                ON posts (created_at DESC)
                WHERE deleted_at IS NULL AND is_reclipped = 0
            ');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (! in_array($driver, ['pgsql', 'sqlite'], true)) {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS posts_suggested_places_candidates_idx');

        Schema::table('posts', function (Blueprint $table) {
            $table->index(
                ['is_reclipped', 'created_at'],
                'posts_is_reclipped_created_at_index'
            );
        });
    }
};
