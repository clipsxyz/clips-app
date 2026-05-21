<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PostReportController extends Controller
{
    public function store(Request $request, string $postId): JsonResponse
    {
        $postId = trim($postId);
        if ($postId === '') {
            return response()->json(['error' => 'post_id required'], 422);
        }

        if (!Post::query()->where('id', $postId)->exists()) {
            return response()->json(['error' => 'Post not found'], 404);
        }

        $reason = $request->input('reason');
        $details = $request->input('details');

        PostReport::updateOrCreate(
            [
                'reporter_user_id' => Auth::id(),
                'post_id' => $postId,
            ],
            [
                'reason' => is_string($reason) ? substr(trim($reason), 0, 64) : null,
                'details' => is_string($details) ? trim($details) : null,
            ]
        );

        return response()->json(['ok' => true, 'message' => 'Report received']);
    }
}
