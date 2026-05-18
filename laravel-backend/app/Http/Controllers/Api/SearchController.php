<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Post;
use App\Services\PlaceFeedLevelParser;
use App\Services\PlaceSummaryService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class SearchController extends Controller
{
    /**
     * Place search endpoint for header/discover search.
     * Uses Google Places when configured, falls back to local gazetteer ranking.
     */
    /**
     * Short text blurb for a place (Google editorial_summary when available).
     */
    public function placeSummary(Request $request): JsonResponse
    {
        $request->validate([
            'label' => 'required_without:q|string|max:200',
            'q' => 'required_without:label|string|max:200',
            'place_id' => 'nullable|string|max:255',
        ]);

        $label = trim((string) ($request->query('label') ?: $request->query('q', '')));
        $placeId = trim((string) $request->query('place_id', ''));
        $placeId = $placeId !== '' ? $placeId : null;

        $payload = (new PlaceSummaryService)->summarize($placeId, $label);
        if ($payload === null || trim((string) ($payload['summary'] ?? '')) === '') {
            return response()->json(['summary' => null]);
        }

        return response()->json($payload);
    }

    public function places(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|max:200',
            'limit' => 'nullable|integer|min:1|max:20',
            'mode' => 'nullable|in:all,location,venue,landmark',
            'level' => 'nullable|in:country,region,local',
            'country' => 'nullable|string|max:120',
            'region' => 'nullable|string|max:120',
        ]);

        $qRaw = trim((string) $request->query('q', ''));
        $q = strtolower($qRaw);
        $limit = min((int) $request->query('limit', 10), 20);
        $mode = (string) $request->query('mode', 'all');
        $level = trim((string) $request->query('level', ''));
        $countryName = trim((string) $request->query('country', ''));
        $regionName = trim((string) $request->query('region', ''));

        if ($qRaw === '') {
            return response()->json([]);
        }

        $googleKey = config('services.google_maps.api_key');
        if (is_string($googleKey) && trim($googleKey) !== '') {
            try {
                $searchInput = $this->autocompleteInputForLevel($qRaw, $level, $countryName, $regionName);
                $countryIso = $this->countryNameToIso($countryName);
                $payload = $this->googlePlaceAutocompletePayload(
                    $searchInput,
                    trim($googleKey),
                    $mode,
                    $level,
                    $countryIso !== '' ? $countryIso : null
                );
                if (is_array($payload)) {
                    $predictions = is_array($payload['predictions'] ?? null) ? $payload['predictions'] : [];
                    $mapped = collect($predictions)
                        ->map(function ($item) {
                            $description = (string) ($item['description'] ?? '');
                            $types = is_array($item['types'] ?? null) ? $item['types'] : [];
                            $lowerTypes = array_map(fn($t) => strtolower((string) $t), $types);
                            $kind = $this->classifyPlaceKind($lowerTypes);

                            $levels = (new PlaceFeedLevelParser)->parse(
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
                                'google_types' => $lowerTypes,
                            ];
                        })
                        ->filter(function ($item) use ($mode, $level, $countryName, $regionName) {
                            if ($mode !== 'all' && ($item['type'] ?? 'location') !== $mode) {
                                return false;
                            }
                            if ($level === '') {
                                return true;
                            }

                            return $this->matchesSignupLevel($item, $level, $countryName, $regionName);
                        })
                        ->take($limit)
                        ->values()
                        ->map(function ($item) {
                            unset($item['google_types']);

                            return $item;
                        })
                        ->toArray();

                    if (!empty($mapped)) {
                        return response()->json($mapped);
                    }
                }
            } catch (\Throwable $_) {
                // Fall through to local fallback
            }
        }

        // Fallback: local gazetteer for location mode + heuristics for venue/landmark strings.
        $results = [];
        $gazetteerPath = storage_path('app/data/locations.json');
        if (($mode === 'all' || $mode === 'location') && file_exists($gazetteerPath)) {
            $data = json_decode(file_get_contents($gazetteerPath), true);
            $scored = collect(is_array($data) ? $data : [])
                ->map(function ($item) use ($q) {
                    $name = strtolower((string) ($item['name'] ?? ''));
                    $country = strtolower((string) ($item['country'] ?? ''));
                    $isPrefix = str_starts_with($name, $q) || str_starts_with($country, $q);
                    $isIncludes = !$isPrefix && (str_contains($name, $q) || str_contains($country, $q));
                    if (!$isPrefix && !$isIncludes) return null;
                    return ['item' => $item, 'score' => $isPrefix ? 0 : 1];
                })
                ->filter()
                ->sortBy('score')
                ->pluck('item')
                ->values();

            foreach ($scored as $row) {
                $name = (string) ($row['name'] ?? '');
                $country = (string) ($row['country'] ?? '');
                $levels = $this->parsePlaceFeedLevels([], $country ? "{$name}, {$country}" : $name);
                $results[] = [
                    'name' => $name,
                    'type' => 'location',
                    'country' => $country ?: null,
                    'local' => $levels['local'] ?: null,
                    'regional' => $levels['regional'] ?: null,
                    'national' => $levels['national'] ?: null,
                    'display_name' => $levels['display_name'] ?: null,
                    'feed_level' => $levels['feed_level'] ?: null,
                    'place_id' => null,
                ];
                if (count($results) >= $limit) break;
            }
        }

        $venueSeeds = ['Wembley Stadium', '3Arena', 'Phoenix Park Cafe', 'Madison Square Garden', 'O2 Arena', 'Croke Park', 'Aviva Stadium'];
        $landmarkSeeds = ['Eiffel Tower', 'Colosseum', 'Big Ben', 'Statue of Liberty', 'Christ the Redeemer'];
        if ($mode === 'all' || $mode === 'venue') {
            foreach ($venueSeeds as $name) {
                if (str_contains(strtolower($name), $q)) {
                    $results[] = ['name' => $name, 'type' => 'venue', 'country' => null, 'place_id' => null];
                }
            }
        }
        if ($mode === 'all' || $mode === 'landmark') {
            foreach ($landmarkSeeds as $name) {
                if (str_contains(strtolower($name), $q)) {
                    $results[] = ['name' => $name, 'type' => 'landmark', 'country' => null, 'place_id' => null];
                }
            }
        }

        $deduped = collect($results)
            ->filter(fn($item) => !empty($item['name']))
            ->filter(function ($item) use ($mode) {
                if ($mode === 'all') {
                    return true;
                }

                return ($item['type'] ?? 'location') === $mode;
            })
            ->unique(fn($item) => strtolower((string) $item['name']))
            ->take($limit)
            ->values()
            ->toArray();

        return response()->json($deduped);
    }

    /**
     * Unified search across users, locations, and posts
     */
    public function unified(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|max:200',
            'types' => 'nullable|string',
            'usersCursor' => 'nullable|integer|min:0',
            'locationsCursor' => 'nullable|integer|min:0',
            'postsCursor' => 'nullable|integer|min:0',
            'usersLimit' => 'nullable|integer|min:1|max:50',
            'locationsLimit' => 'nullable|integer|min:1|max:50',
            'postsLimit' => 'nullable|integer|min:1|max:50',
        ]);

        $qRaw = trim($request->query('q', ''));
        $q = strtolower($qRaw);
        $typesStr = $request->query('types', 'users,locations,posts');
        $types = array_filter(array_map('trim', explode(',', $typesStr)));

        $usersCursor = (int) $request->query('usersCursor', 0);
        $locationsCursor = (int) $request->query('locationsCursor', 0);
        $postsCursor = (int) $request->query('postsCursor', 0);

        $usersLimit = min((int) $request->query('usersLimit', 10), 50);
        $locationsLimit = min((int) $request->query('locationsLimit', 10), 50);
        $postsLimit = min((int) $request->query('postsLimit', 10), 50);

        $sections = [];

        // Locations section (from gazetteer)
        if (in_array('locations', $types)) {
            $gazetteerPath = storage_path('app/data/locations.json');
            $data = [];
            
            if (file_exists($gazetteerPath)) {
                $data = json_decode(file_get_contents($gazetteerPath), true);
            }

            $scored = collect($data)
                ->map(function ($item) use ($q) {
                    $name = strtolower($item['name'] ?? '');
                    $country = strtolower($item['country'] ?? '');
                    $joined = trim("$name $country");
                    $isPrefix = str_starts_with($name, $q) || 
                               str_starts_with($country, $q) || 
                               str_starts_with($joined, $q);
                    $isIncludes = !$isPrefix && (
                        str_contains($name, $q) || 
                        str_contains($country, $q)
                    );
                    
                    if (!$isPrefix && !$isIncludes) {
                        return null;
                    }
                    
                    return [
                        'item' => $item,
                        'score' => $isPrefix ? 0 : 1
                    ];
                })
                ->filter()
                ->sortBy('score')
                ->pluck('item')
                ->values()
                ->toArray();

            $start = $locationsCursor * $locationsLimit;
            $slice = array_slice($scored, $start, $locationsLimit);
            $hasMore = ($start + count($slice) < count($scored));
            $nextCursor = $hasMore ? $locationsCursor + 1 : null;

            $sections['locations'] = [
                'items' => $slice,
                'nextCursor' => $nextCursor,
                'hasMore' => $hasMore,
            ];
        }

        // Users section (from DB)
        if (in_array('users', $types)) {
            $offset = $usersCursor * $usersLimit;
            $users = User::query()
                ->where(function ($query) use ($q) {
                    $query->whereRaw("LOWER(handle) LIKE ?", ["%$q%"])
                        ->orWhereRaw("LOWER(display_name) LIKE ?", ["%$q%"]);
                })
                ->select('id', 'username', 'display_name', 'handle', 'avatar_url')
                ->orderByRaw(
                    "CASE WHEN LOWER(handle) LIKE ? OR LOWER(display_name) LIKE ? THEN 0 ELSE 1 END",
                    ["$q%", "$q%"]
                )
                ->orderByRaw(
                    "CASE WHEN LOWER(handle) = ? THEN 0 WHEN LOWER(display_name) = ? THEN 1 ELSE 2 END",
                    [$q, $q]
                )
                ->orderBy('handle')
                ->offset($offset)
                ->limit($usersLimit + 1)
                ->get();

            $hasMore = $users->count() > $usersLimit;
            if ($hasMore) {
                $users = $users->take($usersLimit)->values();
            }
            $nextCursor = $hasMore ? $usersCursor + 1 : null;

            $sections['users'] = [
                'items' => $users->values(),
                'nextCursor' => $nextCursor,
                'hasMore' => $hasMore,
            ];
        }

        // Posts section (from DB)
        if (in_array('posts', $types)) {
            $offset = $postsCursor * $postsLimit;
            $posts = Post::query()
                ->where(function ($query) use ($q) {
                    $query->whereRaw("LOWER(COALESCE(text_content, '')) LIKE ?", ["%$q%"])
                        ->orWhereRaw("LOWER(COALESCE(location_label, '')) LIKE ?", ["%$q%"])
                        ->orWhereRaw("LOWER(COALESCE(venue, '')) LIKE ?", ["%$q%"])
                        ->orWhereRaw("LOWER(COALESCE(landmark, '')) LIKE ?", ["%$q%"]);
                })
                ->select('id', 'user_id', 'user_handle', 'text_content', 'media_url', 'media_type', 'location_label', 'created_at')
                ->orderByRaw(
                    "CASE WHEN LOWER(COALESCE(text_content, '')) LIKE ? OR LOWER(COALESCE(location_label, '')) LIKE ? THEN 0 ELSE 1 END",
                    ["$q%", "$q%"]
                )
                ->orderBy('created_at', 'desc')
                ->offset($offset)
                ->limit($postsLimit + 1)
                ->get();

            $hasMore = $posts->count() > $postsLimit;
            if ($hasMore) {
                $posts = $posts->take($postsLimit)->values();
            }
            $nextCursor = $hasMore ? $postsCursor + 1 : null;

            $sections['posts'] = [
                'items' => $posts,
                'nextCursor' => $nextCursor,
                'hasMore' => $hasMore,
            ];
        }

        return response()->json([
            'q' => $qRaw,
            'sections' => $sections
        ]);
    }

    /**
     * Google Places Autocomplete (legacy). Tries Laravel Http first; on Windows SSL issues
     * falls back to file_get_contents which uses PHP's default CA bundle.
     *
     * @return array<string, mixed>|null
     */
    /**
     * Map app search tab → Google Places Autocomplete types restriction.
     * @see https://developers.google.com/maps/documentation/places/web-service/autocomplete
     */
    private function googleAutocompleteTypesForMode(string $mode): ?string
    {
        return match ($mode) {
            'venue' => 'establishment',
            'location' => 'geocode',
            default => null,
        };
    }

    private function classifyPlaceKind(array $lowerTypes): string
    {
        $landmarkHints = [
            'tourist_attraction', 'natural_feature', 'park', 'museum', 'church',
            'mosque', 'synagogue', 'hindu_temple', 'university', 'cemetery',
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

    private function autocompleteInputForLevel(string $qRaw, string $level, string $countryName, string $regionName): string
    {
        if ($level === 'local' && $regionName !== '' && $countryName !== '') {
            return trim($qRaw) === ''
                ? "{$regionName}, {$countryName}"
                : "{$qRaw}, {$regionName}, {$countryName}";
        }
        if ($level === 'region' && $countryName !== '' && trim($qRaw) === '') {
            return $countryName;
        }

        return $qRaw;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function matchesSignupLevel(array $item, string $level, string $countryName, string $regionName): bool
    {
        $name = strtolower((string) ($item['name'] ?? ''));
        $national = strtolower((string) ($item['national'] ?? ''));
        $regional = strtolower((string) ($item['regional'] ?? ''));
        $feedLevel = (string) ($item['feed_level'] ?? '');
        $types = is_array($item['google_types'] ?? null) ? $item['google_types'] : [];
        $countryLower = strtolower($countryName);

        if ($countryLower !== '') {
            $inCountry = str_contains($name, $countryLower)
                || $national === $countryLower
                || str_ends_with($name, ", {$countryLower}");
            if (!$inCountry) {
                return false;
            }
        }

        if ($level === 'country') {
            if (in_array('country', $types, true)) {
                return true;
            }

            return $feedLevel === 'national';
        }

        if ($level === 'region') {
            if ($countryLower !== '' && ($national === $countryLower && $feedLevel === 'national')) {
                return false;
            }
            if (in_array('administrative_area_level_1', $types, true)) {
                return true;
            }

            return $feedLevel === 'regional' || ($feedLevel === 'local' && $countryLower !== '');
        }

        if ($level === 'local') {
            $regionLower = strtolower($regionName);
            if ($regionLower !== '') {
                $inRegion = str_contains($name, $regionLower) || $regional === $regionLower;
                if (!$inRegion) {
                    return false;
                }
            }
            if (in_array('locality', $types, true) || in_array('sublocality', $types, true)) {
                return true;
            }

            return $feedLevel === 'local';
        }

        return true;
    }

    private function countryNameToIso(string $countryName): string
    {
        $map = [
            'Ireland' => 'ie', 'Northern Ireland' => 'gb', 'UK' => 'gb', 'Germany' => 'de', 'France' => 'fr',
            'Spain' => 'es', 'Italy' => 'it', 'Netherlands' => 'nl', 'Belgium' => 'be', 'Switzerland' => 'ch',
            'Brazil' => 'br', 'USA' => 'us', 'United States' => 'us', 'Canada' => 'ca', 'Mexico' => 'mx',
            'Argentina' => 'ar', 'Australia' => 'au', 'New Zealand' => 'nz', 'Japan' => 'jp', 'China' => 'cn',
            'India' => 'in', 'Portugal' => 'pt', 'Poland' => 'pl', 'Sweden' => 'se', 'Norway' => 'no',
            'Denmark' => 'dk', 'Finland' => 'fi', 'Austria' => 'at', 'Greece' => 'gr', 'Turkey' => 'tr',
            'South Africa' => 'za', 'Nigeria' => 'ng', 'Egypt' => 'eg', 'Kenya' => 'ke', 'Colombia' => 'co',
            'Chile' => 'cl', 'Peru' => 'pe', 'Venezuela' => 've', 'Ecuador' => 'ec', 'Russia' => 'ru',
            'Singapore' => 'sg', 'Thailand' => 'th', 'Vietnam' => 'vn', 'Philippines' => 'ph', 'Indonesia' => 'id',
        ];
        $trimmed = trim($countryName);
        if ($trimmed === '') {
            return '';
        }
        if (isset($map[$trimmed])) {
            return $map[$trimmed];
        }
        foreach ($map as $name => $iso) {
            if (strcasecmp($name, $trimmed) === 0) {
                return $iso;
            }
        }

        return '';
    }

    private function googleAutocompleteTypesForSignupLevel(string $level): ?string
    {
        return match ($level) {
            'country' => '(regions)',
            'region' => '(regions)',
            'local' => '(cities)',
            default => null,
        };
    }

    private function googlePlaceAutocompletePayload(
        string $input,
        string $apiKey,
        string $mode = 'all',
        string $level = '',
        ?string $countryIso = null
    ): ?array {
        $query = [
            'input' => $input,
            'key' => $apiKey,
        ];
        $signupTypes = $this->googleAutocompleteTypesForSignupLevel($level);
        if ($signupTypes !== null) {
            $query['types'] = $signupTypes;
        } else {
            $types = $this->googleAutocompleteTypesForMode($mode);
            if ($types !== null) {
                $query['types'] = $types;
            }
        }
        if ($countryIso !== null && $countryIso !== '') {
            $query['components'] = 'country:'.strtolower($countryIso);
        }

        try {
            $response = Http::timeout(6)->get(
                'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                $query
            );
            if ($response->ok()) {
                $payload = $response->json();
                if (is_array($payload) && ($payload['status'] ?? '') === 'OK') {
                    return $payload;
                }
            }
        } catch (\Throwable $_) {
            // Guzzle/cURL SSL errors on some Windows PHP installs — try stream fallback.
        }

        $url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?'
            .http_build_query($query);
        $context = stream_context_create([
            'http' => ['timeout' => 6],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null;
        }
        $payload = json_decode($body, true);
        if (!is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }

        return $payload;
    }
}

