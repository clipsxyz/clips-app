<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Links a post to the gazetteer region it was taken in.
 *
 * Strictly nullable and additive. Every existing row keeps a NULL here, so no user post
 * can be lost and no backfill is required to run this. Nothing reads the column yet --
 * Post::scopeByLocation() still resolves locations by LIKE-matching the free-text
 * location_label / venue / landmark strings, and only matching when that text happens to
 * contain a comma-separated city is NOT part of this change. Resolution into
 * gazetteer_regions.id is a separate, deliberate step.
 *
 * Guarded with hasColumn() because the posts table in this working tree, on `main`, and
 * in the live dev SQLite database do not all have the same columns, and this migration
 * must be safe to run against whichever of them is current. Same guard style as
 * 2026_08_18_000001_add_geo_fields_to_posts_and_centroids.php.
 *
 * !! SQLITE DOES NOT GET THE FOREIGN KEY, SILENTLY. !!
 * SQLiteGrammar::compileAdd() only ever emits `ALTER TABLE ... ADD COLUMN`; SQLite has
 * no `ADD CONSTRAINT` and Laravel does not rebuild the table for FK additions. The
 * column and the index are created, the constraint is dropped without error or warning.
 * Verified: `PRAGMA foreign_key_list(posts)` shows only user_id and original_post_id,
 * and a post accepts gazetteer_region_id = 999999 with no region in gazetteer_regions.
 * On pgsql and mysql the constraint is emitted correctly:
 *   alter table "posts" add constraint "posts_gazetteer_region_id_foreign"
 *     foreign key ("gazetteer_region_id") references "gazetteer_regions" ("id")
 *     on delete set null
 * Since the dev/test database is SQLite, referential integrity on this column is NOT
 * enforced locally and must not be relied on. Enforce in the model or backfill job
 * instead, and re-check once this reaches PostgreSQL.
 *
 * ON DELETE SET NULL, deliberately, and not CASCADE. This column points from user
 * content to a geography record; cascading would mean deleting a gazetteer region
 * silently deleting the posts inside it. Unlinking is the safe direction. (The alias and
 * place-mapping tables cascade, which is fine there -- an alias or a Google place id
 * with no region is meaningless, but a post without a region is still a user's post.)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('posts') && ! Schema::hasColumn('posts', 'gazetteer_region_id')) {
            Schema::table('posts', function (Blueprint $table) {
                // NULLABLE: existing posts have no region and must stay that way.
                $table->foreignId('gazetteer_region_id')
                    ->nullable()
                    ->index('posts_gazetteer_region_id_index')
                    ->after('place_id')
                    ->constrained('gazetteer_regions')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // On pgsql/mysql this drops the constraint then the column.
        //
        // On SQLite the constraint was never created (see the class docblock), but
        // Blueprint still records it, and SQLiteGrammar throws BadMethodCallException
        // from compileDropForeign(): "SQLite doesn't support dropping foreign keys (you
        // would need to re-create the table)." That throw aborts the whole rollback
        // before the column is dropped. So call dropForeign only where a constraint can
        // actually exist, then drop the index and column.
        if (Schema::hasTable('posts') && Schema::hasColumn('posts', 'gazetteer_region_id')) {
            Schema::table('posts', function (Blueprint $table) {
                if (DB::connection()->getDriverName() !== 'sqlite') {
                    $table->dropForeign(['gazetteer_region_id']);
                }

                $table->dropIndex('posts_gazetteer_region_id_index');
                $table->dropColumn('gazetteer_region_id');
            });
        }
    }
};
