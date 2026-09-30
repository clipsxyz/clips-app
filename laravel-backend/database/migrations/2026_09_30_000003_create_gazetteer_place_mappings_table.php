<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Maps a Google Places `place_id` onto an internal gazetteer region.
 *
 * This is the bridge that lets the app stop treating Google's opaque identifier as if
 * it were a location. Today `posts.place_id` and `location_centroids.place_id` both hold
 * raw `ChIJ...` strings and nothing resolves them; `location_centroids` even contains a
 * row labelled "Ireland" whose coordinates are in Indiana, USA, because
 * GoogleMapsLocationService::rememberCentroid() upserts on `label` before `place_id`.
 * Nothing in the schema can distinguish a verified mapping from a bad automatic one.
 *
 * NOTE: `location_centroids.place_id` already exists with a unique index. This table
 * deliberately does not replace or read it -- no existing table has been touched -- but
 * until one is retired there are two places holding a Google place_id and only one of
 * them resolves to a region. That has to be settled before either is treated as
 * authoritative.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gazetteer_place_mappings', function (Blueprint $table) {
            $table->id();

            // Google's opaque place identifier, e.g. 'ChIJL6wn6oAOZ0gRoHExl6nHAAo'.
            // Unique, which already provides the index; a second plain index on the
            // same column would be redundant.
            $table->string('google_place_id')->unique();

            // Which internal Level 0-3 region this Google place resolves to.
            // CASCADE: see the caveat on down() below.
            $table->foreignId('gazetteer_region_id')
                ->constrained('gazetteer_regions')
                ->cascadeOnDelete();

            // Denormalised copy of the Google's display string, kept so a mapping row
            // can be audited ("this said Galway, pointing at Ireland") without a
            // second round trip. Nullable -- not every source supplies it.
            $table->string('formatted_name')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        // CAVEAT: because gazetteer_region_id is ON DELETE CASCADE, deleting a region
        // erases the mapping rows that referenced it -- including the evidence that a
        // given google_place_id was ever mapped at all. For the table whose purpose is
        // repairing bad location data, that is the wrong default. Consider
        // ON DELETE SET NULL with a nullable column plus a tombstone marker, which
        // would preserve the mapping history. Left as CASCADE because that is what was
        // specified.
        Schema::dropIfExists('gazetteer_place_mappings');
    }
};
