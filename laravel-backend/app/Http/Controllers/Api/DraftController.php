<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Draft;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class DraftController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Authentication required'], 401);
        }

        $drafts = Draft::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Draft $draft) => $this->toClient($draft));

        return response()->json($drafts->values());
    }

    /**
     * Create or update a draft for the authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Authentication required'], 401);
        }

        $validator = Validator::make($request->all(), [
            'id' => 'nullable|uuid',
            'title' => 'nullable|string|max:255',
            'media_url' => 'nullable|string',
            'mediaUrl' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $mediaUrl = $request->input('media_url', $request->input('mediaUrl'));
        $title = $this->nullableTrimmed($request->input('title'));
        $metadata = $request->input('metadata');
        if (! is_array($metadata)) {
            $metadata = [];
        }

        $draft = null;
        $id = $request->input('id');
        if (is_string($id) && Str::isUuid($id)) {
            $draft = Draft::query()
                ->where('user_id', $user->id)
                ->where('id', $id)
                ->first();
        }

        $payload = [
            'title' => $title,
            'media_url' => is_string($mediaUrl) ? $mediaUrl : null,
            'metadata' => $metadata,
        ];

        if ($draft) {
            $draft->fill($payload);
            $draft->save();
        } else {
            $draft = Draft::create([
                'user_id' => $user->id,
                ...$payload,
            ]);
        }

        return response()->json($this->toClient($draft->fresh()), $draft->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Authentication required'], 401);
        }

        $draft = Draft::query()
            ->where('user_id', $user->id)
            ->where('id', $id)
            ->first();

        if (! $draft) {
            return response()->json(['error' => 'Draft not found'], 404);
        }

        $draft->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toClient(Draft $draft): array
    {
        return [
            'id' => (string) $draft->id,
            'userId' => (string) $draft->user_id,
            'title' => $draft->title,
            'mediaUrl' => $draft->media_url,
            'media_url' => $draft->media_url,
            'metadata' => is_array($draft->metadata) ? $draft->metadata : [],
            'createdAt' => $draft->created_at ? ((int) $draft->created_at->timestamp * 1000) : 0,
            'updatedAt' => $draft->updated_at ? ((int) $draft->updated_at->timestamp * 1000) : 0,
        ];
    }

    private function nullableTrimmed(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
