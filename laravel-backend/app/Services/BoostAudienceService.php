<?php

namespace App\Services;

use App\Models\Boost;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Geographic audience logic for boosts.
 *
 * One place for "who should see this boost" so the feed, the active-ids endpoint
 * and pricing can never disagree. Everything here is deliberately cheap: the
 * feed calls it per boost candidate, and a page must never turn into a query
 * storm. Centroid lookups are memoised per process.
 */
class BoostAudienceService
{
    /** @var array<string,array{lat:float,lng:float}|null> */
    private static array $centroidCache = [];

    /**
     * Feed tiers a location filter should pull boosts from.
     *
     * Mirrors the client mapping in src/api/posts.ts (tabToBoostFeedType) so the
     * server no longer depends on the client deciding what belongs in a tab:
     *   - countries            -> national boosts
     *   - cities               -> regional boosts
     *   - everything else      -> local boosts
     *   - the Following feed   -> every tier
     *
     * @return array<int,string>
     */
    public function feedTypesForFilter(string $filter): array
    {
        $raw = strtolower(trim($filter));

        if ($raw === '' || $raw === 'following' || $raw === 'discover') {
            return ['local', 'regional', 'national'];
        }

        if (self::isCountry($raw)) {
            return ['national'];
        }

        if (self::isCity($raw)) {
            return ['regional'];
        }

        return ['local'];
    }

    /**
     * Whether a viewer sits inside a boost's target radius.
     *
     * Returns null when eligibility cannot be determined — no recorded radius, or
     * either side has no resolvable coordinates. Callers treat null as "do not
     * gate": a viewer with incomplete location data keeps seeing the Sponsored
     * disclosure rather than silently losing it.
     */
    public function isEligibleFor(?User $viewer, Boost $boost): ?bool
    {
        $radiusKm = $boost->radius_km === null ? null : (float) $boost->radius_km;
        if ($radiusKm === null || $radiusKm <= 0) {
            return null; // Nothing to enforce.
        }

        $viewerCoords = $this->viewerCoords($viewer);
        $centerCoords = $this->boostCenterCoords($boost);

        if (!$viewerCoords || !$centerCoords) {
            return null;
        }

        return $this->haversineKm(
            $centerCoords['lat'],
            $centerCoords['lng'],
            $viewerCoords['lat'],
            $viewerCoords['lng']
        ) <= $radiusKm;
    }

    /**
     * Coordinates a boost's radius is measured from: frozen at activation, with a
     * label-resolve fallback for rows created before those columns existed.
     *
     * @return array{lat:float,lng:float}|null
     */
    public function boostCenterCoords(Boost $boost): ?array
    {
        if ($boost->center_lat !== null && $boost->center_lng !== null) {
            return ['lat' => (float) $boost->center_lat, 'lng' => (float) $boost->center_lng];
        }

        return $this->centroidCoords($boost->center_local);
    }

    /**
     * The viewer's own coordinates, most specific first.
     *
     * @return array{lat:float,lng:float}|null
     */
    public function viewerCoords(?User $viewer): ?array
    {
        if (!$viewer) {
            return null;
        }

        return $this->centroidCoords(
            $viewer->location_local ?: ($viewer->location_regional ?: $viewer->location_national)
        );
    }

    /**
     * Resolve a place label to coordinates.
     *
     * @return array{lat:float,lng:float}|null
     */
    public function centroidCoords(?string $label): ?array
    {
        if (!$label) {
            return null;
        }

        if (array_key_exists($label, self::$centroidCache)) {
            return self::$centroidCache[$label];
        }

        $row = DB::table('location_centroids')->where('label', $label)->first(['latitude', 'longitude']);
        if ($row) {
            return self::$centroidCache[$label] = [
                'lat' => (float) $row->latitude,
                'lng' => (float) $row->longitude,
            ];
        }

        // Live Google resolve + cache when the seed table does not have this place yet.
        try {
            $resolved = (new GoogleMapsLocationService)->resolve(null, $label);
            if ($resolved && isset($resolved['latitude'], $resolved['longitude'])) {
                return self::$centroidCache[$label] = [
                    'lat' => (float) $resolved['latitude'],
                    'lng' => (float) $resolved['longitude'],
                ];
            }
        } catch (\Throwable $e) {
            // Ignore — a place we cannot place simply is not gated.
        }

        return self::$centroidCache[$label] = null;
    }

    public function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadiusKm * $c;
    }

    private static function isCountry(string $needle): bool
    {
        return in_array($needle, self::countryList(), true);
    }

    private static function isCity(string $needle): bool
    {
        return in_array($needle, self::cityList(), true);
    }

    /** @return array<int,string> */
    private static function countryList(): array
    {
        return [
            'ireland', 'uk', 'united kingdom', 'england', 'scotland', 'wales', 'france', 'spain', 'portugal', 'germany',
            'netherlands', 'belgium', 'italy', 'switzerland', 'austria', 'poland', 'czech republic', 'hungary', 'greece',
            'romania', 'sweden', 'norway', 'denmark', 'finland', 'russia', 'turkey', 'japan', 'china', 'south korea',
            'australia', 'new zealand', 'usa', 'united states', 'united states of america', 'canada', 'mexico', 'brazil',
            'argentina', 'chile', 'colombia', 'india', 'indonesia', 'thailand', 'vietnam', 'malaysia', 'singapore',
            'philippines', 'south africa', 'egypt', 'nigeria', 'morocco', 'israel', 'uae', 'saudi arabia',
        ];
    }

    /** @return array<int,string> */
    private static function cityList(): array
    {
        return [
            'dublin', 'cork', 'galway', 'limerick', 'waterford', 'kilkenny', 'belfast',
            'london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'liverpool', 'bristol', 'leeds',
            'paris', 'lyon', 'marseille', 'berlin', 'munich', 'hamburg', 'frankfurt', 'cologne',
            'madrid', 'barcelona', 'valencia', 'rome', 'milan', 'naples', 'florence', 'venice',
            'amsterdam', 'rotterdam', 'brussels', 'vienna', 'lisbon', 'porto', 'prague', 'budapest',
            'warsaw', 'krakow', 'bucharest', 'athens', 'zurich', 'geneva',
            'copenhagen', 'stockholm', 'oslo', 'helsinki', 'reykjavik', 'tallinn', 'riga', 'vilnius',
            'moscow', 'saint petersburg', 'istanbul', 'ankara',
            'new york', 'new york state', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
            'san antonio', 'san diego', 'dallas', 'austin', 'seattle', 'denver', 'boston', 'miami',
            'atlanta', 'toronto', 'vancouver', 'montreal',
        ];
    }
}
