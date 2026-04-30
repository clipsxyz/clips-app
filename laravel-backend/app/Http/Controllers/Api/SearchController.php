<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class SearchController extends Controller
{
    /**
     * Place search endpoint for header/discover search.
     * Uses Google Places when configured, falls back to local gazetteer ranking.
     */
    public function places(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|max:200',
            'limit' => 'nullable|integer|min:1|max:20',
            'mode' => 'nullable|in:all,location,venue,landmark',
        ]);

        $qRaw = trim((string) $request->query('q', ''));
        $q = strtolower($qRaw);
        $limit = min((int) $request->query('limit', 10), 20);
        $mode = (string) $request->query('mode', 'all');

        if ($qRaw === '') {
            return response()->json([]);
        }

        $googleKey = config('services.google_maps.api_key');
        if (is_string($googleKey) && trim($googleKey) !== '') {
            try {
                $google = Http::timeout(6)->get('https://maps.googleapis.com/maps/api/place/autocomplete/json', [
                    'input' => $qRaw,
                    'key' => $googleKey,
                    'types' => 'geocode|establishment',
                ]);
                if ($google->ok()) {
                    $payload = $google->json();
                    $predictions = is_array($payload['predictions'] ?? null) ? $payload['predictions'] : [];
                    $mapped = collect($predictions)
                        ->map(function ($item) {
                            $description = (string) ($item['description'] ?? '');
                            $types = is_array($item['types'] ?? null) ? $item['types'] : [];
                            $lowerTypes = array_map(fn($t) => strtolower((string) $t), $types);

                            $kind = 'location';
                            if (in_array('establishment', $lowerTypes, true) || in_array('point_of_interest', $lowerTypes, true)) {
                                $kind = 'venue';
                            }
                            if (
                                in_array('tourist_attraction', $lowerTypes, true) ||
                                in_array('natural_feature', $lowerTypes, true) ||
                                in_array('premise', $lowerTypes, true)
                            ) {
                                $kind = 'landmark';
                            }

                            $country = null;
                            if (!empty($item['terms']) && is_array($item['terms'])) {
                                $last = end($item['terms']);
                                if (is_array($last) && !empty($last['value'])) {
                                    $country = (string) $last['value'];
                                }
                            }

                            return [
                                'name' => $description,
                                'type' => $kind,
                                'country' => $country,
                                'place_id' => $item['place_id'] ?? null,
                            ];
                        })
                        ->filter(function ($item) use ($mode) {
                            if ($mode === 'all') return true;
                            return ($item['type'] ?? 'location') === $mode;
                        })
                        ->take($limit)
                        ->values()
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
        if (file_exists($gazetteerPath)) {
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
                $results[] = [
                    'name' => (string) ($row['name'] ?? ''),
                    'type' => 'location',
                    'country' => $row['country'] ?? null,
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
                        ->orWhereRaw("LOWER(COALESCE(location_label, '')) LIKE ?", ["%$q%"]);
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
}

