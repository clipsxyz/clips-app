<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alternate names for a gazetteer region: exonyms, nicknames, abbreviations and
 * translations ("The DCC", "D1", "Baile Átha Cliath").
 *
 * `posts.venue` / `posts.landmark` / `posts.location_label` are free-text and matched
 * with `LIKE '%needle%'` in Post::scopeByLocation(). Without this table a substring
 * match is the only way a typed name can find a region, so "Dublin" also matches
 * "Dublin, Ohio". Resolving those strings to a real region is what this table is for.
 *
 * CAVEAT: the unique index below is case- and accent-sensitive on SQLite and
 * PostgreSQL, so "The DCC" and "the dcc" are accepted as two distinct aliases. There is
 * no normalised column to collapse them. See the model docblock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gazetteer_region_aliases', function (Blueprint $table) {
            $table->id();

            // CASCADE: an alias has no meaning without its region, so removing a
            // region removes its aliases rather than orphaning them.
            $table->foreignId('gazetteer_region_id')
                ->constrained('gazetteer_regions')
                ->cascadeOnDelete();

            $table->string('alias');

            $table->timestamps();

            // Scoped uniqueness: the same alias may legitimately exist under two
            // different regions (a "Springfield" per state), but not twice under one.
            $table->unique(['gazetteer_region_id', 'alias']);

            // The composite unique above cannot serve a lookup by alias alone, because
            // gazetteer_region_id is its leading column.
            $table->index('alias');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gazetteer_region_aliases');
    }
};
