<?php

namespace App\Support;

/**
 * Country ↔ city roll-up for location feeds.
 *
 * City filters stay exact. Country filters include known child cities so a
 * Madrid-tagged post appears in Spain without pulling Galway into Dublin.
 */
class LocationHierarchy
{
    /** @var array<string, list<string>> */
    private const COUNTRY_ALIASES = [
        'ireland' => ['ireland', 'éire', 'eire', 'republic of ireland'],
        'spain' => ['spain', 'españa', 'espana'],
        'uk' => ['uk', 'united kingdom', 'great britain', 'britain'],
        'united kingdom' => ['uk', 'united kingdom', 'great britain', 'britain'],
        'england' => ['england'],
        'scotland' => ['scotland'],
        'wales' => ['wales'],
        'france' => ['france'],
        'germany' => ['germany', 'deutschland'],
        'italy' => ['italy', 'italia'],
        'usa' => ['usa', 'us', 'united states', 'united states of america'],
        'united states' => ['usa', 'us', 'united states', 'united states of america'],
        'canada' => ['canada'],
        'australia' => ['australia'],
        'portugal' => ['portugal'],
        'netherlands' => ['netherlands', 'holland'],
        'belgium' => ['belgium'],
        'austria' => ['austria'],
        'switzerland' => ['switzerland'],
        'poland' => ['poland'],
        'japan' => ['japan'],
        'china' => ['china'],
        'india' => ['india'],
        'brazil' => ['brazil'],
        'mexico' => ['mexico'],
        'argentina' => ['argentina'],
    ];

    /** @var array<string, list<string>> */
    private const COUNTRY_CITIES = [
        'ireland' => ['dublin', 'cork', 'galway', 'limerick', 'waterford', 'kilkenny', 'belfast', 'finglas', 'artane', 'ballymun', 'oranmore', 'dún laoghaire', 'dun laoghaire', 'swords', 'tallaght'],
        'spain' => ['madrid', 'barcelona', 'valencia', 'seville', 'sevilla', 'malaga', 'málaga', 'bilbao', 'granada', 'zaragoza', 'seville'],
        'uk' => ['london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'liverpool', 'bristol', 'leeds', 'cardiff', 'belfast', 'newcastle'],
        'united kingdom' => ['london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'liverpool', 'bristol', 'leeds', 'cardiff', 'belfast', 'newcastle'],
        'england' => ['london', 'manchester', 'birmingham', 'liverpool', 'bristol', 'leeds', 'newcastle'],
        'scotland' => ['edinburgh', 'glasgow'],
        'wales' => ['cardiff'],
        'france' => ['paris', 'lyon', 'marseille'],
        'germany' => ['berlin', 'munich', 'hamburg', 'frankfurt', 'cologne'],
        'italy' => ['rome', 'milan', 'naples', 'florence', 'venice'],
        'usa' => ['new york', 'los angeles', 'chicago', 'houston', 'miami', 'boston', 'seattle', 'san francisco', 'atlanta'],
        'united states' => ['new york', 'los angeles', 'chicago', 'houston', 'miami', 'boston', 'seattle', 'san francisco', 'atlanta'],
        'canada' => ['toronto', 'vancouver', 'montreal', 'calgary'],
        'australia' => ['sydney', 'melbourne', 'brisbane', 'perth'],
        'portugal' => ['lisbon', 'porto'],
        'netherlands' => ['amsterdam', 'rotterdam'],
        'belgium' => ['brussels'],
        'austria' => ['vienna'],
        'switzerland' => ['zurich', 'geneva'],
        'poland' => ['warsaw', 'krakow'],
        'japan' => ['tokyo', 'osaka', 'kyoto'],
        'china' => ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hong kong'],
        'india' => ['mumbai', 'delhi', 'bangalore', 'chennai'],
        'brazil' => ['são paulo', 'sao paulo', 'rio de janeiro'],
        'mexico' => ['mexico city', 'guadalajara', 'monterrey'],
        'argentina' => ['buenos aires'],
    ];

    public static function normalize(string $value): string
    {
        return strtolower(trim($value));
    }

    public static function isCountry(string $filter): bool
    {
        $key = self::normalize($filter);

        return $key !== '' && isset(self::COUNTRY_ALIASES[$key]);
    }

    /**
     * @return list<string>
     */
    public static function countryAliases(string $filter): array
    {
        $key = self::normalize($filter);

        return self::COUNTRY_ALIASES[$key] ?? ($key !== '' ? [$key] : []);
    }

    /**
     * @return list<string>
     */
    public static function citiesForCountry(string $filter): array
    {
        $key = self::normalize($filter);

        return self::COUNTRY_CITIES[$key] ?? [];
    }

    public static function countryForCity(string $city): ?string
    {
        $needle = self::normalize($city);
        if ($needle === '') {
            return null;
        }

        foreach (self::COUNTRY_CITIES as $country => $cities) {
            if (in_array($needle, $cities, true)) {
                return $country;
            }
        }

        return null;
    }

    /**
     * @return array{local: string, regional: string, national: string}
     */
    public static function parseLabel(string $label): array
    {
        $parser = new \App\Services\PlaceFeedLevelParser;
        $levels = $parser->parse([], $label);

        $national = trim((string) ($levels['national'] ?? ''));
        if ($national === '' || ! self::isCountry($national)) {
            $inferred = self::countryForCity((string) ($levels['regional'] ?? ''))
                ?? self::countryForCity((string) ($levels['local'] ?? ''))
                ?? self::countryForCity($label);
            if ($inferred) {
                $national = ucwords($inferred === 'uk' ? 'UK' : $inferred);
            }
        }

        return [
            'local' => trim((string) ($levels['local'] ?? '')),
            'regional' => trim((string) ($levels['regional'] ?? '')),
            'national' => $national,
        ];
    }

    public static function composeLabel(?string $label, ?string $local, ?string $regional, ?string $national): string
    {
        $parts = [];
        foreach ([$label, $local, $regional, $national] as $part) {
            $part = trim((string) $part);
            if ($part === '') {
                continue;
            }
            foreach ($parts as $existing) {
                if (strcasecmp($existing, $part) === 0 || stripos($existing, $part) !== false) {
                    continue 2;
                }
            }
            $parts[] = $part;
        }

        return implode(', ', $parts);
    }
}
