<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Services\SuggestedPlacesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class SuggestedPlacesController extends Controller
{
    /**
     * Posts whose venue / location overlaps the viewer’s home or travel signals.
     * Auth: Sanctum. Optional body/query: places_traveled[] for client-held list until stored on user row.
     * Cached ~60s per user + request shape (invalidated when profile updates via version key).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'limit' => 'sometimes|integer|min:1|max:30',
            'include_poster_regional' => 'sometimes|boolean',
            'places_traveled' => 'sometimes|array',
            'places_traveled.*' => 'string|max:200',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $limit = min(30, max(1, (int) $request->input('limit', 12)));
        $includePoster = filter_var($request->input('include_poster_regional', false), FILTER_VALIDATE_BOOLEAN);
        $extraPlaces = $request->input('places_traveled', []);
        if (! is_array($extraPlaces)) {
            $extraPlaces = [];
        }
        $extraPlaces = array_values(array_filter(
            $extraPlaces,
            fn ($p) => is_string($p) && mb_strlen(trim($p)) >= 2
        ));

        $profileVer = (int) Cache::get('user_profile_sig_version:'.$user->id, 0);
        $extraKey = md5(json_encode($extraPlaces));
        $cacheKey = 'suggested_by_places:v1:'.$user->id.':'.$profileVer.':'.($includePoster ? '1' : '0').':'.$limit.':'.$extraKey;

        $payload = Cache::remember($cacheKey, 60, function () use ($user, $limit, $includePoster, $extraPlaces) {
            $user->refresh();

            $buckets = SuggestedPlacesService::collectBuckets($user, $extraPlaces);
            if (count($buckets['home']) === 0 && count($buckets['traveled']) === 0) {
                return [
                    'suggestions' => [],
                    'meta' => ['count' => 0, 'include_poster_regional' => $includePoster, 'cached' => true],
                ];
            }

            $candidates = Post::query()
                ->with([
                    'user:id,handle,display_name,avatar_url,location_local,location_regional,location_national',
                    'taggedUsers:id,handle,display_name,avatar_url',
                ])
                ->withCount(['likes', 'comments', 'shares', 'views', 'reclips'])
                ->notReclipped()
                ->where('user_id', '!=', $user->id)
                ->where(function ($q) {
                    $q->whereNotNull('venue')
                        ->orWhereNotNull('landmark')
                        ->orWhereNotNull('location_label')
                        ->orWhereHas('user', function ($uq) {
                            $uq->whereNotNull('location_local');
                        });
                })
                ->orderBy('created_at', 'desc')
                ->limit(280)
                ->get();

            $suggestions = [];
            $seen = [];
            foreach ($candidates as $post) {
                $hit = SuggestedPlacesService::findBestMatch($post, $buckets, $includePoster);
                if ($hit === null) {
                    continue;
                }
                if (isset($seen[$post->id])) {
                    continue;
                }
                $seen[$post->id] = true;
                $suggestions[] = [
                    'matched_place' => $hit['matched_place'],
                    'reason' => $hit['reason'],
                    'post' => PostController::toApiArray($post, $user),
                ];
                if (count($suggestions) >= $limit) {
                    break;
                }
            }

            return [
                'suggestions' => $suggestions,
                'meta' => [
                    'count' => count($suggestions),
                    'include_poster_regional' => $includePoster,
                    'cached' => true,
                ],
            ];
        });

        return response()->json($payload);
    }
}
