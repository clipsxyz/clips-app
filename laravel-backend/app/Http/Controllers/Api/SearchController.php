<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
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
            $nextCursor = ($start + count($slice) < count($scored)) ? $locationsCursor + 1 : null;

            $sections['locations'] = [
                'items' => $slice,
                'nextCursor' => $nextCursor
            ];
        }

        // Users section (from DB)
        if (in_array('users', $types)) {
            $offset = $usersCursor * $usersLimit;
            
            // Prefix-first ranking
            $prefixUsers = User::where(function ($query) use ($q) {
                $query->whereRaw("LOWER(handle) LIKE ?", ["$q%"])
                      ->orWhereRaw("LOWER(display_name) LIKE ?", ["$q%"]);
            })
            ->select('id', 'username', 'display_name', 'handle', 'avatar_url')
            ->limit($usersLimit)
            ->offset($offset)
            ->get();

            $remainingLimit = $usersLimit - $prefixUsers->count();
            
            $substringUsers = collect();
            if ($remainingLimit > 0) {
                $substringUsers = User::where(function ($query) use ($q) {
                    $query->whereRaw("(LOWER(handle) LIKE ? OR LOWER(display_name) LIKE ?)", ["%$q%", "%$q%"])
                          ->whereRaw("NOT (LOWER(handle) LIKE ? OR LOWER(display_name) LIKE ?)", ["$q%", "$q%"]);
                })
                ->select('id', 'username', 'display_name', 'handle', 'avatar_url')
                ->limit($remainingLimit)
                ->get();
            }

            $users = $prefixUsers->concat($substringUsers);
            $nextCursor = $users->count() === $usersLimit ? $usersCursor + 1 : null;

            $sections['users'] = [
                'items' => $users->values(),
                'nextCursor' => $nextCursor
            ];
        }

        // Posts section (from DB)
        if (in_array('posts', $types)) {
            $offset = $postsCursor * $postsLimit;
            
            $posts = Post::where(function ($query) use ($q) {
                $query->whereRaw("LOWER(COALESCE(text_content, '')) LIKE ?", ["%$q%"])
                      ->orWhereRaw("LOWER(COALESCE(location_label, '')) LIKE ?", ["%$q%"]);
            })
            ->select('id', 'user_id', 'user_handle', 'text_content', 'media_url', 'media_type', 'location_label', 'created_at')
            ->orderBy('created_at', 'desc')
            ->limit($postsLimit)
            ->offset($offset)
            ->get();

            $nextCursor = $posts->count() === $postsLimit ? $postsCursor + 1 : null;

            $sections['posts'] = [
                'items' => $posts,
                'nextCursor' => $nextCursor
            ];
        }

        return response()->json([
            'q' => $qRaw,
            'sections' => $sections
        ]);
    }
}

