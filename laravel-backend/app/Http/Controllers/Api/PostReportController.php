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
        $answers = [];
        foreach ((array) $request->input('answers', []) as $row) {
            if (! is_array($row) || count($answers) >= 8) {
                continue;
            }
            $question = isset($row['question']) && is_string($row['question']) ? trim($row['question']) : '';
            $answer = isset($row['answer']) && is_string($row['answer']) ? trim($row['answer']) : '';
            if ($question === '' || $answer === '') {
                continue;
            }
            $choiceId = isset($row['choiceId']) && is_string($row['choiceId']) ? trim($row['choiceId']) : '';
            $answers[] = [
                'question' => substr($question, 0, 200),
                'answer' => substr($answer, 0, 500),
                'choiceId' => substr($choiceId, 0, 64),
            ];
        }

        // Stored for review only. The post stays up, and the author is not told who reported it.
        PostReport::updateOrCreate(
            [
                'reporter_user_id' => Auth::id(),
                'post_id' => $postId,
            ],
            [
                'reason' => is_string($reason) ? substr(trim($reason), 0, 64) : null,
                'details' => is_string($details) ? substr(trim($details), 0, 2000) : null,
                'answers' => $answers,
                'status' => 'pending',
            ]
        );

        return response()->json(['ok' => true, 'message' => 'Report received', 'status' => 'pending']);
    }
}
