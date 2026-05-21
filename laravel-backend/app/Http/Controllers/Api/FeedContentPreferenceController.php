<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeedContentPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FeedContentPreferenceController extends Controller
{
    private function normalizeHandle(?string $handle): ?string
    {
        if (!$handle) {
            return null;
        }
        $normalized = strtolower(ltrim(trim($handle), '@'));
        return $normalized !== '' ? $normalized : null;
    }

    private function normalizePostId(?string $postId): ?string
    {
        if (!$postId) {
            return null;
        }
        $normalized = trim($postId);
        return $normalized !== '' ? $normalized : null;
    }

    private function prefsForUser(): FeedContentPreference
    {
        return FeedContentPreference::firstOrCreate(
            ['user_id' => Auth::id()],
            [
                'muted_handles' => [],
                'blocked_handles' => [],
                'hidden_post_ids' => [],
                'not_interested_post_ids' => [],
            ]
        );
    }

    private function toResponse(FeedContentPreference $prefs): JsonResponse
    {
        return response()->json([
            'muted_handles' => array_values($prefs->muted_handles ?? []),
            'blocked_handles' => array_values($prefs->blocked_handles ?? []),
            'hidden_post_ids' => array_values($prefs->hidden_post_ids ?? []),
            'not_interested_post_ids' => array_values($prefs->not_interested_post_ids ?? []),
        ]);
    }

    public function show(): JsonResponse
    {
        return $this->toResponse($this->prefsForUser());
    }

    public function mute(Request $request): JsonResponse
    {
        $handle = $this->normalizeHandle($request->input('handle'));
        if (!$handle) {
            return response()->json(['error' => 'handle required'], 422);
        }
        $prefs = $this->prefsForUser();
        $list = $prefs->muted_handles ?? [];
        if (!in_array($handle, $list, true)) {
            $list[] = $handle;
        }
        $prefs->muted_handles = array_values($list);
        $prefs->save();
        return $this->toResponse($prefs);
    }

    public function block(Request $request): JsonResponse
    {
        $handle = $this->normalizeHandle($request->input('handle'));
        if (!$handle) {
            return response()->json(['error' => 'handle required'], 422);
        }
        $prefs = $this->prefsForUser();
        $list = $prefs->blocked_handles ?? [];
        if (!in_array($handle, $list, true)) {
            $list[] = $handle;
        }
        $prefs->blocked_handles = array_values($list);
        $prefs->save();
        return $this->toResponse($prefs);
    }

    public function hide(Request $request): JsonResponse
    {
        $postId = $this->normalizePostId($request->input('post_id') ?? $request->input('postId'));
        if (!$postId) {
            return response()->json(['error' => 'post_id required'], 422);
        }
        $prefs = $this->prefsForUser();
        $list = $prefs->hidden_post_ids ?? [];
        if (!in_array($postId, $list, true)) {
            $list[] = $postId;
        }
        $prefs->hidden_post_ids = array_values($list);
        $prefs->save();
        return $this->toResponse($prefs);
    }

    public function notInterested(Request $request): JsonResponse
    {
        $postId = $this->normalizePostId($request->input('post_id') ?? $request->input('postId'));
        if (!$postId) {
            return response()->json(['error' => 'post_id required'], 422);
        }
        $prefs = $this->prefsForUser();
        $list = $prefs->not_interested_post_ids ?? [];
        if (!in_array($postId, $list, true)) {
            $list[] = $postId;
        }
        $prefs->not_interested_post_ids = array_values($list);
        $prefs->save();
        return $this->toResponse($prefs);
    }
}
