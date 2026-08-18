<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Resolves places to real lat/lng via Google Geocoding + Place Details,
 * and caches centroids in `location_centroids` for boosts / geospatial features.
 */
class GoogleMapsLocationService
{
    public function __construct(
        private readonly PlaceFeedLevelParser $feedLevelParser = new PlaceFeedLevelParser
    ) {
    }

    public function apiKey(): string
    {
        $key = config('services.google_maps.api_key');

        return is_string($key) ? trim($key) : '';
    }

    public function isConfigured(): bool
    {
        return $this->apiKey() !== '';
    }

    /**
     * Resolve a Google place_id and/or free-text address to Gazetteer location fields.
     *
     * @return array{
     *   label: string,
     *   display_name: string,
     *   place_id: string|null,
     *   latitude: float,
     *   longitude: float,
     *   local: string|null,
     *   regional: string|null,
     *   national: string|null,
     *   feed_level: string|null,
     *   formatted_address: string|null
     * }|null
     */
    public function resolve(?string $placeId = null, ?string $query = null): ?array
    {
        $placeId = is_string($placeId) ? trim($placeId) : '';
        $query = is_string($query) ? trim($query) : '';

        if ($placeId === '' && $query === '') {
            return null;
        }

        if ($placeId !== '') {
            $fromCache = $this->centroidByPlaceId($placeId);
            if ($fromCache !== null && $query === '') {
                return $fromCache;
            }
        }

        if (!$this->isConfigured()) {
            return $this->centroidByLabel($query !== '' ? $query : null);
        }

        $resolved = null;
        if ($placeId !== '') {
            $resolved = $this->geocodeByPlaceId($placeId) ?? $this->placeDetails($placeId);
        }
        if ($resolved === null && $query !== '') {
            $resolved = $this->geocodeByAddress($query);
        }
        if ($resolved === null) {
            return $this->centroidByLabel($query !== '' ? $query : null)
                ?? ($placeId !== '' ? $this->centroidByPlaceId($placeId) : null);
        }

        $this->rememberCentroid($resolved);

        return $resolved;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function geocodeByPlaceId(string $placeId): ?array
    {
        return $this->geocodeRequest(['place_id' => $placeId]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function geocodeByAddress(string $address): ?array
    {
        return $this->geocodeRequest(['address' => $address]);
    }

    /**
     * @param  array<string, string>  $params
     * @return array<string, mixed>|null
     */
    private function geocodeRequest(array $params): ?array
    {
        $key = $this->apiKey();
        if ($key === '') {
            return null;
        }

        try {
            $response = Http::timeout(8)->get(
                'https://maps.googleapis.com/maps/api/geocode/json',
                array_merge($params, ['key' => $key])
            );
            if (!$response->ok()) {
                return null;
            }
            $payload = $response->json();
        } catch (\Throwable $e) {
            Log::warning('google.geocode failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (!is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }

        $results = is_array($payload['results'] ?? null) ? $payload['results'] : [];
        $first = $results[0] ?? null;
        if (!is_array($first)) {
            return null;
        }

        return $this->mapGeocodeResult($first);
    }

    /**
     * Legacy Place Details fallback when Geocoding by place_id is restricted.
     *
     * @return array<string, mixed>|null
     */
    public function placeDetails(string $placeId): ?array
    {
        $key = $this->apiKey();
        if ($key === '' || trim($placeId) === '') {
            return null;
        }

        try {
            $response = Http::timeout(8)->get(
                'https://maps.googleapis.com/maps/api/place/details/json',
                [
                    'place_id' => $placeId,
                    'fields' => 'place_id,name,formatted_address,geometry,address_component,type',
                    'key' => $key,
                ]
            );
            if (!$response->ok()) {
                return null;
            }
            $payload = $response->json();
        } catch (\Throwable $e) {
            Log::warning('google.place_details failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (!is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }
        $result = $payload['result'] ?? null;
        if (!is_array($result)) {
            return null;
        }

        $lat = $result['geometry']['location']['lat'] ?? null;
        $lng = $result['geometry']['location']['lng'] ?? null;
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return null;
        }

        $formatted = trim((string) ($result['formatted_address'] ?? $result['name'] ?? ''));
        $components = is_array($result['address_components'] ?? null) ? $result['address_components'] : [];
        $levels = $this->levelsFromAddressComponents($components, $formatted !== '' ? $formatted : (string) ($result['name'] ?? ''));

        return [
            'label' => $levels['display_name'] ?: ($formatted !== '' ? $formatted : (string) ($result['name'] ?? 'Unknown')),
            'display_name' => $levels['display_name'] ?: null,
            'place_id' => trim((string) ($result['place_id'] ?? $placeId)) ?: null,
            'latitude' => (float) $lat,
            'longitude' => (float) $lng,
            'local' => $levels['local'] ?: null,
            'regional' => $levels['regional'] ?: null,
            'national' => $levels['national'] ?: null,
            'feed_level' => $levels['feed_level'] ?: null,
            'formatted_address' => $formatted !== '' ? $formatted : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>|null
     */
    private function mapGeocodeResult(array $result): ?array
    {
        $lat = $result['geometry']['location']['lat'] ?? null;
        $lng = $result['geometry']['location']['lng'] ?? null;
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return null;
        }

        $formatted = trim((string) ($result['formatted_address'] ?? ''));
        $components = is_array($result['address_components'] ?? null) ? $result['address_components'] : [];
        $levels = $this->levelsFromAddressComponents($components, $formatted);
        $placeId = trim((string) ($result['place_id'] ?? ''));

        return [
            'label' => $levels['display_name'] ?: ($formatted !== '' ? $formatted : 'Unknown'),
            'display_name' => $levels['display_name'] ?: null,
            'place_id' => $placeId !== '' ? $placeId : null,
            'latitude' => (float) $lat,
            'longitude' => (float) $lng,
            'local' => $levels['local'] ?: null,
            'regional' => $levels['regional'] ?: null,
            'national' => $levels['national'] ?: null,
            'feed_level' => $levels['feed_level'] ?: null,
            'formatted_address' => $formatted !== '' ? $formatted : null,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $components
     * @return array{local: string, regional: string, national: string, display_name: string, feed_level: string}
     */
    private function levelsFromAddressComponents(array $components, string $fallbackDescription): array
    {
        $byType = [];
        foreach ($components as $component) {
            if (!is_array($component)) {
                continue;
            }
            $name = trim((string) ($component['long_name'] ?? ''));
            $types = is_array($component['types'] ?? null) ? $component['types'] : [];
            if ($name === '') {
                continue;
            }
            foreach ($types as $type) {
                $byType[(string) $type] = $name;
            }
        }

        $national = $byType['country'] ?? '';
        $regional = $byType['locality']
            ?? $byType['postal_town']
            ?? $byType['administrative_area_level_2']
            ?? $byType['administrative_area_level_1']
            ?? '';
        $local = $byType['neighborhood']
            ?? $byType['sublocality']
            ?? $byType['sublocality_level_1']
            ?? $byType['locality']
            ?? '';

        if ($local === '' && $regional === '' && $national === '') {
            return $this->feedLevelParser->parse([], $fallbackDescription);
        }

        $parts = array_values(array_filter([$local, $regional, $national], fn ($v) => $v !== ''));
        $description = $fallbackDescription !== '' ? $fallbackDescription : implode(', ', $parts);
        $terms = array_map(fn ($v) => ['value' => $v], $parts);

        return $this->feedLevelParser->parse($terms, $description);
    }

    /**
     * @param  array<string, mixed>  $resolved
     */
    public function rememberCentroid(array $resolved): void
    {
        $lat = $resolved['latitude'] ?? null;
        $lng = $resolved['longitude'] ?? null;
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return;
        }

        $label = trim((string) ($resolved['display_name'] ?? $resolved['label'] ?? ''));
        if ($label === '') {
            $label = trim((string) ($resolved['formatted_address'] ?? ''));
        }
        if ($label === '') {
            return;
        }

        $placeId = trim((string) ($resolved['place_id'] ?? ''));
        $now = now();

        try {
            $existing = null;
            if ($placeId !== '' && $this->centroidsHavePlaceId()) {
                $existing = DB::table('location_centroids')->where('place_id', $placeId)->first();
            }
            if ($existing === null) {
                $existing = DB::table('location_centroids')->where('label', $label)->first();
            }

            $payload = [
                'label' => $label,
                'latitude' => (float) $lat,
                'longitude' => (float) $lng,
                'updated_at' => $now,
            ];
            if ($this->centroidsHavePlaceId() && $placeId !== '') {
                $payload['place_id'] = $placeId;
            }

            if ($existing) {
                DB::table('location_centroids')->where('id', $existing->id)->update($payload);
            } else {
                $payload['created_at'] = $now;
                DB::table('location_centroids')->insert($payload);
            }
        } catch (\Throwable $e) {
            Log::warning('location_centroids upsert failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function centroidByLabel(?string $label): ?array
    {
        $label = is_string($label) ? trim($label) : '';
        if ($label === '') {
            return null;
        }

        $row = DB::table('location_centroids')->where('label', $label)->first();
        if (!$row) {
            // Try first segment ("Dublin" from "Dublin, Ireland")
            $short = trim(explode(',', $label)[0] ?? '');
            if ($short !== '' && strcasecmp($short, $label) !== 0) {
                $row = DB::table('location_centroids')->where('label', $short)->first();
            }
        }
        if (!$row) {
            return null;
        }

        return $this->rowToResolved($row, $label);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function centroidByPlaceId(string $placeId): ?array
    {
        if (! $this->centroidsHavePlaceId() || trim($placeId) === '') {
            return null;
        }
        $row = DB::table('location_centroids')->where('place_id', $placeId)->first();
        if (!$row) {
            return null;
        }

        return $this->rowToResolved($row, (string) $row->label);
    }

    /**
     * @param  object  $row
     * @return array<string, mixed>
     */
    private function rowToResolved(object $row, string $fallbackLabel): array
    {
        $label = trim((string) ($row->label ?? $fallbackLabel));
        $levels = $this->feedLevelParser->parse([], $label);

        return [
            'label' => $label,
            'display_name' => $levels['display_name'] ?: $label,
            'place_id' => isset($row->place_id) ? (trim((string) $row->place_id) ?: null) : null,
            'latitude' => (float) $row->latitude,
            'longitude' => (float) $row->longitude,
            'local' => $levels['local'] ?: null,
            'regional' => $levels['regional'] ?: null,
            'national' => $levels['national'] ?: null,
            'feed_level' => $levels['feed_level'] ?: null,
            'formatted_address' => $label,
        ];
    }

    private function centroidsHavePlaceId(): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        try {
            $cached = \Illuminate\Support\Facades\Schema::hasColumn('location_centroids', 'place_id');
        } catch (\Throwable $_) {
            $cached = false;
        }

        return $cached;
    }
}
