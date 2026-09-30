<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Resolves a Google Places identifier to an internal gazetteer region.
 *
 * `formatted_name` is a denormalised copy of Google's own display string, not a
 * normalised name -- `gazetteer_regions.name` is the authoritative label. It exists so a
 * mapping can be eyeballed ("this said Galway") without re-querying Google.
 *
 * @property int $id
 * @property string $google_place_id
 * @property int $gazetteer_region_id
 * @property string|null $formatted_name
 */
class GazetteerPlaceMapping extends Model
{
    protected $fillable = [
        'google_place_id',
        'gazetteer_region_id',
        'formatted_name',
    ];

    public function region(): BelongsTo
    {
        return $this->belongsTo(GazetteerRegion::class, 'gazetteer_region_id');
    }
}
