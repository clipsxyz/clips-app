<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class LocationController extends Controller
{
    /**
     * Search locations from gazetteer data
     */
    public function search(Request $request): JsonResponse
    {
        $q = strtolower(trim($request->query('q', '')));
        $limit = min((int) $request->query('limit', 20), 50);

        if (empty($q)) {
            return response()->json([]);
        }

        // Load gazetteer data
        $gazetteerPath = storage_path('app/data/locations.json');
        if (!file_exists($gazetteerPath)) {
            // Fallback: return empty array if file doesn't exist
            return response()->json([]);
        }

        $data = json_decode(file_get_contents($gazetteerPath), true);

        // Rank prefix matches first, then substring matches
        $scored = collect($data)
            ->map(function ($item) use ($q) {
                $name = strtolower($item['name'] ?? '');
                $isPrefix = str_starts_with($name, $q);
                $isIncludes = !$isPrefix && str_contains($name, $q);
                
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
            ->take($limit)
            ->pluck('item')
            ->values()
            ->toArray();

        return response()->json($scored);
    }
}

