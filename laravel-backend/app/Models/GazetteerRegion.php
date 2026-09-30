<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A node in the gazetteer hierarchy: Country (admin_level 0) -> County/Region
 * (admin_level 1|2) -> City/District (admin_level 3).
 *
 * `boundary` is deliberately absent from $fillable and $casts: it is a PostGIS geometry
 * on PostgreSQL/MySQL and WKT text on engines without spatial support, so it has no
 * single portable cast. Read it through the query builder (ST_AsText / ST_Within) rather
 * than eager-loading it.
 *
 * `name` holds the OFFICIAL name and is stored verbatim: "County Dublin", "Co. Cork",
 * "County Galway". Never abbreviated, stripped, or normalised on write -- this is the
 * source of truth for the underlying geography and other systems read it. There is
 * deliberately no name mutator, no `setNameAttribute()` accessor, and no boot hook that
 * rewrites it, so nothing can quietly "clean up" a county prefix at write time.
 *
 * Shortening for the UI ("County Dublin" -> "Dublin") is presentation-only and lives in
 * app/Support/RegionDisplayName.php. Call that at the edge; keep this column official.
 *
 * @property int $id
 * @property string $slug
 * @property string $name Official name, stored verbatim ("County Dublin", not "Dublin")
 * @property int $admin_level 0 = Country, 1|2 = County/Region, 3 = City/District
 * @property string $type country|county|city
 * @property int|null $parent_id
 * @property string|null $centroid_lat
 * @property string|null $centroid_lng
 */
class GazetteerRegion extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'admin_level',
        'type',
        'parent_id',
        'centroid_lat',
        'centroid_lng',
    ];

    protected $casts = [
        'admin_level' => 'integer',
        'parent_id' => 'integer',
        // Kept as decimal strings so a stored value keeps its full precision; cast
        // to float at the point of use for distance maths.
        'centroid_lat' => 'decimal:7',
        'centroid_lng' => 'decimal:7',
    ];

    /** Country nodes. */
    public const LEVEL_COUNTRY = 0;

    /** Lowest accepted county/region tier. */
    public const LEVEL_COUNTY_LOW = 1;

    /** Highest accepted county/region tier. */
    public const LEVEL_COUNTY_HIGH = 2;

    /** City / district nodes. */
    public const LEVEL_CITY = 3;

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function aliases(): HasMany
    {
        return $this->hasMany(GazetteerRegionAlias::class);
    }

    public function placeMappings(): HasMany
    {
        return $this->hasMany(GazetteerPlaceMapping::class);
    }
}
