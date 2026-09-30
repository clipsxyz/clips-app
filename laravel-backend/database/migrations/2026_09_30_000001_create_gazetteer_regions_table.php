<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hierarchical gazetteer regions: Country (0) -> County/Region (1|2) -> City/District (3).
 *
 * This is the first table in this schema that carries a real spatial boundary. It is
 * added separately from `location_centroids`, which holds a single approximate point
 * per label and no boundary at all, and which nothing in the app can join a post to by
 * geography.
 *
 * The `boundary` column and its index are driver-specific and are added by
 * `addBoundaryColumn()` / `addBoundaryIndex()` after the scalar columns exist. They
 * cannot be declared inline for three reasons:
 *
 *   1. `Blueprint::spatialIndex()` is compiled by SQLiteGrammar::compileSpatialIndex(),
 *      which throws RuntimeException('The database driver in use does not support
 *      spatial indexes.'). This app's .env sets DB_CONNECTION=sqlite, so an inline
 *      spatialIndex() fails the whole migration.
 *   2. On PostgreSQL, `Blueprint::polygon()` compiles to `geography(polygon, 4326)`
 *      unless the undocumented `isGeometry` Fluent attribute is also set, because
 *      PostgresGrammar::formatPostGisType() only emits `geometry(...)` when
 *      `$column->isGeometry !== null`. Raw DDL is used so the column is exactly
 *      geometry(polygon, 4326).
 *   3. The geometry type only exists once PostGIS is installed. This migration does NOT
 *      create the extension, because CREATE EXTENSION requires superuser and would fail
 *      on a locked-down connection. PostGIS presence is detected instead, and the column
 *      degrades to WKT text when it is absent.
 */
return new class extends Migration
{
    /**
     * SRID for every boundary. 4326 (WGS84) matches lat/lng order, which is why
     * centroid_lat/centroid_lng are named in that order rather than lng/lat.
     */
    private const SRID = 4326;

    /** Drivers that can store a native polygon type. */
    private const SPATIAL_DRIVERS = ['pgsql', 'mysql'];

    public function up(): void
    {
        Schema::create('gazetteer_regions', function (Blueprint $table) {
            $table->id();

            // Public, stable identifier. e.g. 'ireland', 'county-dublin', 'dublin-city'.
            // `unique()` already creates the index; a second plain index on the same
            // column would be redundant.
            $table->string('slug')->unique();

            // Human label. e.g. 'Ireland', 'County Dublin', 'Dublin City'.
            //
            // OFFICIAL NAME, STORED VERBATIM. Include "County" / "Co." where the
            // authority uses it -- do not strip, abbreviate, or normalise it in this
            // migration, in a seeder, or in the model. This column is the source of
            // truth for the underlying geography and other systems read it, so it
            // records what the authority actually calls the place.
            //
            // Shortening for the UI ("County Dublin" -> "Dublin") is presentation-only
            // and belongs in app/Support/RegionDisplayName.php, applied at the edge.
            $table->string('name');

            // 0 = Country, 1|2 = County/Region, 3 = City/District.
            $table->unsignedTinyInteger('admin_level');

            $table->enum('type', ['country', 'county', 'city']);

            // Self-reference for Country -> County -> City. Deleting a parent nulls the
            // children's parent_id rather than cascading, so a region is not destroyed
            // by the removal of its parent.
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->foreign('parent_id')->references('id')->on('gazetteer_regions')->nullOnDelete();

            // Convenience centroids for fast filtering/sorting when boundary is null.
            $table->decimal('centroid_lat', 10, 7)->nullable();
            $table->decimal('centroid_lng', 10, 7)->nullable();

            $table->timestamps();

            $table->index('admin_level');
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($this->hasPostgis()) {
            DB::statement(sprintf(
                'ALTER TABLE gazetteer_regions ADD COLUMN boundary geometry(polygon, %d)',
                self::SRID
            ));
        } else {
            // Portable fallback: WKT text, e.g. 'POLYGON((-6.28 53.34, ...))'.
            DB::statement('ALTER TABLE gazetteer_regions ADD COLUMN boundary TEXT NULL');
        }

        $this->addBoundaryIndex($driver);
    }

    public function down(): void
    {
        Schema::dropIfExists('gazetteer_regions');
    }

    /**
     * Whether this connection can accept a PostGIS geometry column.
     *
     * Only ever true on PostgreSQL: MySQL's `polygon` type is built in and needs no
     * extension, but its index still has to go through addBoundaryIndex().
     */
    private function hasPostgis(): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return false;
        }

        try {
            $result = DB::selectOne("SELECT COUNT(*) AS aggregate FROM pg_extension WHERE extname = 'postgis'");

            return (int) ($result->aggregate ?? 0) > 0;
        } catch (\Throwable $e) {
            // No pg_extension catalog access; treat as absent and fall back to WKT.
            return false;
        }
    }

    /**
     * Spatial index on boundary, only where the driver supports one.
     *
     * No index is created on SQLite or SQL Server. That is a real gap, not an oversight:
     * those engines cannot answer ST_Within without the extension, and the fallback
     * boundary column holds WKT text, which no such engine could index spatially anyway.
     */
    private function addBoundaryIndex(string $driver): void
    {
        if (! in_array($driver, self::SPATIAL_DRIVERS, true)) {
            return;
        }

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE gazetteer_regions ADD SPATIAL INDEX gazetteer_regions_boundary_index (boundary)');

            return;
        }

        // pgsql. Only legal on a real geometry column.
        if (! $this->hasPostgis()) {
            return;
        }

        DB::statement('CREATE INDEX gazetteer_regions_boundary_index ON gazetteer_regions USING GIST (boundary)');
    }
};
