<?php

namespace App\Services;

class BoostPricing
{
    /** Six-hour base price in euro cents. */
    private const TIER_BASE_CENTS = [
        'standard' => 499,
        'premium' => 999,
        'featured' => 1999,
        'local' => 499,
        'regional' => 999,
        'national' => 1999,
    ];

    public static function cents(string $tier, int $duration): int
    {
        $base = self::TIER_BASE_CENTS[$tier] ?? self::TIER_BASE_CENTS['standard'];
        $multiplier = match ($duration) {
            6 => 1.0,
            12 => 1.75,
            24 => 2.8,
            72 => 6.2,
            default => 1.0,
        };

        return (int) round($base * $multiplier);
    }

    public static function eur(string $tier, int $duration): float
    {
        return round(self::cents($tier, $duration) / 100, 2);
    }
}
