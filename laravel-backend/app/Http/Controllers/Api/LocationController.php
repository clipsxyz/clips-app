<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GoogleMapsLocationService;
use App\Services\PlaceFeedLevelParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class LocationController extends Controller
{
    public function __construct(
        private readonly GoogleMapsLocationService $maps = new GoogleMapsLocationService
    ) {
    }

    /**
     * Search locations — Google Places Autocomplete when configured, else local gazetteer.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|max:200',
            'limit' => 'nullable|integer|min:1|max:50',
            'mode' => 'nullable|in:all,location,venue,landmark',
        ]);

        $qRaw = trim((string) $request->query('q', ''));
        $limit = min((int) $request->query('limit', 20), 50);
        $mode = (string) $request->query('mode', 'all');

        if ($qRaw === '') {
            return response()->json([]);
        }

        if ($this->maps->isConfigured()) {
            $google = $this->googleAutocomplete($qRaw, $limit, $mode);
            if ($google !== []) {
                return response()->json($google);
            }
        }

        return response()->json($this->gazetteerSearch($qRaw, $limit, $mode));
    }

    /**
     * Resolve place_id and/or address text to real coordinates via Geocoding / Place Details.
     */
    public function geocode(Request $request): JsonResponse
    {
        $request->validate([
            'place_id' => 'nullable|string|max:255',
            'q' => 'nullable|string|max:200',
            'label' => 'nullable|string|max:200',
        ]);

        $placeId = trim((string) $request->query('place_id', ''));
        $query = trim((string) ($request->query('q') ?: $request->query('label', '')));

        if ($placeId === '' && $query === '') {
            return response()->json(['error' => 'place_id or q is required'], 422);
        }

        $resolved = $this->maps->resolve(
            $placeId !== '' ? $placeId : null,
            $query !== '' ? $query : null
        );

        if ($resolved === null) {
            return response()->json([
                'error' => 'Location not found',
                'configured' => $this->maps->isConfigured(),
            ], 404);
        }

        return response()->json($resolved);
    }

    /**
     * Place Details for a Google place_id (geometry + feed tiers).
     */
    public function details(Request $request): JsonResponse
    {
        $request->validate([
            'place_id' => 'required|string|max:255',
        ]);

        $placeId = trim((string) $request->query('place_id', ''));
        $resolved = $this->maps->resolve($placeId, null);

        if ($resolved === null) {
            return response()->json([
                'error' => 'Place not found',
                'configured' => $this->maps->isConfigured(),
            ], 404);
        }

        return response()->json($resolved);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function googleAutocomplete(string $input, int $limit, string $mode): array
    {
        $key = $this->maps->apiKey();
        $typeQueries = match ($mode) {
            'venue' => ['establishment'],
            'location' => ['geocode'],
            'landmark' => ['tourist_attraction', 'natural_feature', 'park'],
            default => [null],
        };

        $merged = [];
        $seen = [];
        foreach ($typeQueries as $types) {
            $query = [
                'input' => $input,
                'key' => $key,
            ];
            if (is_string($types) && $types !== '') {
                $query['types'] = $types;
            }

            try {
                $response = Http::timeout(6)->get(
                    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                    $query
                );
                if (! $response->ok()) {
                    continue;
                }
                $payload = $response->json();
            } catch (\Throwable $_) {
                continue;
            }

            if (! is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
                continue;
            }

            $predictions = is_array($payload['predictions'] ?? null) ? $payload['predictions'] : [];
            foreach ($predictions as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $placeId = (string) ($item['place_id'] ?? '');
                $dedupe = $placeId !== '' ? $placeId : strtolower((string) ($item['description'] ?? ''));
                if ($dedupe === '' || isset($seen[$dedupe])) {
                    continue;
                }
                $seen[$dedupe] = true;
                $merged[] = $item;
            }
        }

        if ($merged === []) {
            return [];
        }

        $parser = new PlaceFeedLevelParser;

        return collect($merged)
            ->map(function ($item) use ($parser) {
                $description = (string) ($item['description'] ?? '');
                $types = is_array($item['types'] ?? null) ? $item['types'] : [];
                $lowerTypes = array_map(fn ($t) => strtolower((string) $t), $types);
                $kind = $this->classifyPlaceKind($lowerTypes);
                $levels = $parser->parse(
                    is_array($item['terms'] ?? null) ? $item['terms'] : [],
                    $description
                );

                return [
                    'name' => $description,
                    'type' => $kind,
                    'country' => $levels['national'] ?: null,
                    'local' => $levels['local'] ?: null,
                    'regional' => $levels['regional'] ?: null,
                    'national' => $levels['national'] ?: null,
                    'display_name' => $levels['display_name'] ?: null,
                    'feed_level' => $levels['feed_level'] ?: null,
                    'place_id' => $item['place_id'] ?? null,
                ];
            })
            ->filter(function ($item) use ($mode) {
                if ($mode === 'all') {
                    return true;
                }
                // Landmark queries already use landmark-oriented Google types; keep soft matches.
                if ($mode === 'landmark') {
                    return in_array(($item['type'] ?? 'location'), ['landmark', 'venue'], true)
                        || $this->looksLikeLandmarkName((string) ($item['name'] ?? ''));
                }

                return ($item['type'] ?? 'location') === $mode;
            })
            ->take($limit)
            ->values()
            ->all();
    }

    private function looksLikeLandmarkName(string $name): bool
    {
        $lower = strtolower($name);
        foreach (['river', 'park', 'bridge', 'tower', 'castle', 'cathedral', 'museum', 'falls', 'lake', 'mountain', 'monument', 'statue'] as $hint) {
            if (str_contains($lower, $hint)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $lowerTypes
     */
    private function classifyPlaceKind(array $lowerTypes): string
    {
        $landmarkHints = [
            'tourist_attraction', 'natural_feature', 'park', 'museum', 'church',
            'mosque', 'synagogue', 'hindu_temple', 'university', 'cemetery',
            'aquarium', 'zoo', 'amusement_park', 'art_gallery', 'place_of_worship',
            'city_hall', 'library', 'landmark',
        ];
        $venueHints = [
            'establishment', 'point_of_interest', 'restaurant', 'bar', 'cafe',
            'stadium', 'night_club', 'shopping_mall', 'gym', 'lodging', 'store',
        ];

        foreach ($landmarkHints as $type) {
            if (in_array($type, $lowerTypes, true)) {
                return 'landmark';
            }
        }
        foreach ($venueHints as $type) {
            if (in_array($type, $lowerTypes, true)) {
                return 'venue';
            }
        }

        return 'location';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function gazetteerSearch(string $qRaw, int $limit, string $mode): array
    {
        $q = strtolower($qRaw);
        $gazetteerPath = storage_path('app/data/locations.json');
        if (! file_exists($gazetteerPath)) {
            return [];
        }

        $data = json_decode(file_get_contents($gazetteerPath), true);
        $parser = new PlaceFeedLevelParser;

        return collect(is_array($data) ? $data : [])
            ->map(function ($item) use ($q, $parser, $mode) {
                $name = strtolower((string) ($item['name'] ?? ''));
                $isPrefix = str_starts_with($name, $q);
                $isIncludes = ! $isPrefix && str_contains($name, $q);
                if (! $isPrefix && ! $isIncludes) {
                    return null;
                }
                $country = (string) ($item['country'] ?? '');
                $levels = $parser->parse([], $country !== '' ? "{$item['name']}, {$country}" : (string) ($item['name'] ?? ''));
                $type = (string) ($item['type'] ?? 'location');
                if ($mode !== 'all' && $type !== $mode && ! in_array($mode, ['location'], true)) {
                    // gazetteer rows are mostly locations
                    if ($mode !== 'location') {
                        return null;
                    }
                }

                return [
                    'item' => [
                        'name' => (string) ($item['name'] ?? ''),
                        'type' => $type === '' ? 'location' : $type,
                        'country' => $country !== '' ? $country : null,
                        'local' => $levels['local'] ?: null,
                        'regional' => $levels['regional'] ?: null,
                        'national' => $levels['national'] ?: null,
                        'display_name' => $levels['display_name'] ?: null,
                        'feed_level' => $levels['feed_level'] ?: null,
                        'place_id' => $item['place_id'] ?? null,
                    ],
                    'score' => $isPrefix ? 0 : 1,
                ];
            })
            ->filter()
            ->sortBy('score')
            ->take($limit)
            ->pluck('item')
            ->values()
            ->all();
    }
}
