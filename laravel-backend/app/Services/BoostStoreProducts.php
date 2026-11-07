<?php

namespace App\Services;

class BoostStoreProducts
{
    /** Product IDs created in Google Play Console and App Store Connect. */
    public const SKUS = [
        6 => 'gazetteer.boost.6h',
        12 => 'gazetteer.boost.12h',
        24 => 'gazetteer.boost.24h',
        72 => 'gazetteer.boost.72h',
    ];

    public static function sku(int $durationHours): ?string
    {
        return self::SKUS[$durationHours] ?? null;
    }
}
