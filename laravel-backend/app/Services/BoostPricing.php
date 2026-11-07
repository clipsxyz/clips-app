<?php

namespace App\Services;

class BoostPricing
{
    /** Card checkout, about €10.00 per 1,000 people. */
    public const STRIPE_UNIT_PRICE_EUR = 0.010;

    /** App Store and Google Play, about €12.50 per 1,000 people. */
    public const STORE_UNIT_PRICE_EUR = 0.0125;

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
        return (int) round($base * self::durationMultiplier($duration));
    }

    public static function durationMultiplier(int $durationHours): float
    {
        return match ($durationHours) {
            6 => 1.0,
            12 => 1.5,
            24 => 2.2,
            72 => 4.0,
            default => 1.0,
        };
    }

    public static function unitPriceEur(string $gateway): float
    {
        return $gateway === 'store' ? self::STORE_UNIT_PRICE_EUR : self::STRIPE_UNIT_PRICE_EUR;
    }

    /** Stripe cents for audienceCount × gateway rate × duration multiplier. */
    public static function audienceCents(int $audienceCount, int $durationHours, string $gateway = 'stripe'): int
    {
        return (int) round($audienceCount * self::unitPriceEur($gateway) * self::durationMultiplier($durationHours) * 100);
    }

    public static function eur(string $tier, int $duration): float
    {
        return round(self::cents($tier, $duration) / 100, 2);
    }
}
