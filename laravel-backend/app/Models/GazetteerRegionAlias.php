<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An alternate name for a gazetteer region: exonym, nickname, abbreviation or
 * translation.
 *
 * `alias` is stored as typed, with no normalisation. The database-level uniqueness on
 * [gazetteer_region_id, alias] is therefore case- and accent-sensitive on SQLite and
 * PostgreSQL, so "The DCC" and "the dcc" can coexist for one region. Resolve aliases
 * case-insensitively at query time (lower(alias)) rather than assuming the stored value
 * is canonical.
 *
 * @property int $id
 * @property int $gazetteer_region_id
 * @property string $alias
 */
class GazetteerRegionAlias extends Model
{
    protected $fillable = [
        'gazetteer_region_id',
        'alias',
    ];

    public function region(): BelongsTo
    {
        return $this->belongsTo(GazetteerRegion::class, 'gazetteer_region_id');
    }
}
