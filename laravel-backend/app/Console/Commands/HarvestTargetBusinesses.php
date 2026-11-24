<?php

namespace App\Console\Commands;

use App\Models\TargetBusiness;
use App\Services\GoogleMapsLocationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class HarvestTargetBusinesses extends Command
{
    protected $signature = 'gazetteer:harvest-businesses
        {--lat= : Center latitude}
        {--lng= : Center longitude}
        {--radius=1500 : Search radius in meters}
        {--type= : Google Places type, such as restaurant or cafe}';

    protected $description = 'Collect Google Places leads into target_businesses, skipping places cached within 30 days.';

    public function handle(GoogleMapsLocationService $maps): int
    {
        $lat = $this->option('lat');
        $lng = $this->option('lng');
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            $this->error('Pass numeric --lat and --lng.');

            return self::FAILURE;
        }

        if (! $maps->isConfigured()) {
            $this->error('Set GOOGLE_MAPS_API_KEY before harvesting places.');

            return self::FAILURE;
        }

        $radius = (int) $this->option('radius');
        if ($radius < 1) {
            $radius = 1500;
        }
        $radius = min($radius, 50000);
        $type = trim((string) $this->option('type'));

        $created = 0;
        $refreshed = 0;
        $cached = 0;
        $pageToken = null;
        $pages = 0;

        do {
            $results = $this->nearby((float) $lat, (float) $lng, $radius, $type, $maps->apiKey(), $pageToken);
            if ($results === null) {
                $this->error('Google Places nearby search failed.');

                return self::FAILURE;
            }

            foreach ($results['places'] as $place) {
                $placeId = trim((string) ($place['place_id'] ?? ''));
                $name = trim((string) ($place['name'] ?? ''));
                if ($placeId === '' || $name === '') {
                    continue;
                }

                $existing = TargetBusiness::where('google_place_id', $placeId)->first();
                $cacheDays = (int) config('automated_seeding.places_cache_days', 30);
                if (
                    $existing
                    && $existing->cached_at
                    && $existing->cached_at->greaterThan(now()->subDays($cacheDays))
                ) {
                    $cached++;
                    continue;
                }

                $details = $this->details($placeId, $maps->apiKey());
                $payload = $this->payload($place, $details);
                if ($existing) {
                    $existing->fill($payload);
                    $existing->cached_at = now();
                    $existing->save();
                    $refreshed++;
                    continue;
                }

                TargetBusiness::create($payload + [
                    'google_place_id' => $placeId,
                    'outreach_status' => 'pending',
                    'cached_at' => now(),
                ]);
                $created++;
            }

            $pageToken = $results['next_page_token'];
            $pages++;
            if ($pageToken) {
                sleep(2);
            }
        } while ($pageToken && $pages < 3);

        $this->info("Saved {$created} new leads, refreshed {$refreshed}, left {$cached} inside the 30-day cache.");

        return self::SUCCESS;
    }

    /**
     * @return array{places: list<array<string, mixed>>, next_page_token: string|null}|null
     */
    private function nearby(float $lat, float $lng, int $radius, string $type, string $key, ?string $pageToken): ?array
    {
        $params = [
            'location' => $lat.','.$lng,
            'radius' => $radius,
            'key' => $key,
        ];
        if ($type !== '') {
            $params['type'] = $type;
        }
        if ($pageToken) {
            $params = ['pagetoken' => $pageToken, 'key' => $key];
        }

        try {
            $response = Http::timeout(12)->get(
                'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
                $params
            );
        } catch (\Throwable) {
            return null;
        }

        if (! $response->ok()) {
            return null;
        }

        $status = (string) $response->json('status');
        if (! in_array($status, ['OK', 'ZERO_RESULTS'], true)) {
            return null;
        }

        $places = $response->json('results');
        $token = $response->json('next_page_token');

        return [
            'places' => is_array($places) ? $places : [],
            'next_page_token' => is_string($token) && $token !== '' ? $token : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function details(string $placeId, string $key): ?array
    {
        try {
            $response = Http::timeout(12)->get(
                'https://maps.googleapis.com/maps/api/place/details/json',
                [
                    'place_id' => $placeId,
                    'fields' => 'place_id,name,formatted_address,geometry,website,formatted_phone_number,types',
                    'key' => $key,
                ]
            );
        } catch (\Throwable) {
            return null;
        }

        if (! $response->ok() || $response->json('status') !== 'OK') {
            return null;
        }

        $result = $response->json('result');

        return is_array($result) ? $result : null;
    }

    /**
     * @param  array<string, mixed>  $nearby
     * @param  array<string, mixed>|null  $details
     * @return array<string, mixed>
     */
    private function payload(array $nearby, ?array $details): array
    {
        $source = $details ?? $nearby;
        $types = $source['types'] ?? $nearby['types'] ?? [];
        $category = is_array($types) && isset($types[0]) ? str_replace('_', ' ', (string) $types[0]) : null;
        $lat = $source['geometry']['location']['lat'] ?? $nearby['geometry']['location']['lat'] ?? null;
        $lng = $source['geometry']['location']['lng'] ?? $nearby['geometry']['location']['lng'] ?? null;

        return [
            'name' => trim((string) ($source['name'] ?? $nearby['name'] ?? '')),
            'category' => $category,
            'formatted_address' => $this->limitedString($source['formatted_address'] ?? $nearby['vicinity'] ?? null, 500),
            'latitude' => is_numeric($lat) ? (float) $lat : null,
            'longitude' => is_numeric($lng) ? (float) $lng : null,
            'website' => $this->limitedString($details['website'] ?? null, 2048),
            'phone' => $this->limitedString($details['formatted_phone_number'] ?? null, 64),
        ];
    }

    private function limitedString(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_substr($trimmed, 0, $max);
    }
}
