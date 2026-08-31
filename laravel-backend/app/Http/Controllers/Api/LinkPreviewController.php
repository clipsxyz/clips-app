<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LinkPreviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinkPreviewController extends Controller
{
    public function show(Request $request, LinkPreviewService $previews): JsonResponse
    {
        $request->validate([
            'url' => 'required|string|max:2048',
        ]);

        $url = $previews->extractFirstUrl((string) $request->query('url'))
            ?? $previews->extractFirstUrl('https://'.ltrim((string) $request->query('url'), '/'));

        if ($url === null) {
            return response()->json(['error' => 'Invalid URL'], 422);
        }

        $preview = $previews->fetch($url);
        if ($preview === null) {
            return response()->json(['error' => 'Preview unavailable'], 404);
        }

        return response()->json($previews->toClientPayload($preview));
    }
}
