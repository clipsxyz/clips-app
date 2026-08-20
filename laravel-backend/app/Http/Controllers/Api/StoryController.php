<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Story;
use App\Models\StoryReaction;
use App\Models\StoryReply;
use App\Models\StoryView;
use App\Models\User;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Carbon\Carbon;

class StoryController extends Controller
{
    /**
     * Get active stories with keyset cursor pagination.
     */
    public function paged(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cursor' => 'nullable|string',
            'limit' => 'integer|min:1|max:50',
            'userId' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $limit = (int) $request->get('limit', 20);
        $cursorState = $this->decodeStoryCursor((string) $request->get('cursor', ''));
        $userId = $request->get('userId');
        $hasViewer = !empty($userId);

        $query = Story::active()
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['reactions', 'replies', 'views']);

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ])
            ->with(['reactions' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
                $q->select('story_id', 'emoji');
            }]);
        }

        if ($cursorState['created_at'] && $cursorState['id']) {
            $query->where(function ($q) use ($cursorState) {
                $q->where('created_at', '<', $cursorState['created_at'])
                  ->orWhere(function ($q2) use ($cursorState) {
                      $q2->where('created_at', '=', $cursorState['created_at'])
                         ->where('id', '<', $cursorState['id']);
                  });
            });
        }

        $stories = $query->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc')
            ->limit($limit)
            ->get();

        $items = $stories->map(function ($story) use ($hasViewer) {
            $storyData = $story->toArray();
            if ($hasViewer) {
                $attrs = $story->getAttributes();
                $storyData['has_viewed'] = array_key_exists('has_viewed', $attrs)
                    ? (bool) $attrs['has_viewed']
                    : false;
                $storyData['user_reaction'] = $story->relationLoaded('reactions')
                    ? optional($story->reactions->first())->emoji
                    : null;
            } else {
                $storyData['has_viewed'] = false;
                $storyData['user_reaction'] = null;
            }
            return $storyData;
        })->values();

        $lastStory = $stories->last();
        $nextCursor = null;
        if ($stories->count() === $limit && $lastStory) {
            $nextCursor = $this->encodeStoryCursor($lastStory->created_at, (string) $lastStory->id);
        }

        return response()->json([
            'items' => $items,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null,
        ]);
    }

    /**
     * Get all active stories grouped by user
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->get('userId');
        $hasViewer = !empty($userId);
        $query = Story::active()
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['reactions', 'replies', 'views']);

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ])
            ->with(['reactions' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
                $q->select('story_id', 'emoji');
            }]);
        }

        $stories = $query->orderBy('created_at', 'desc')->get();

        // Group by user
        $grouped = $stories->groupBy('user_id')->map(function ($userStories, $userGroupId) use ($hasViewer) {
            $user = $userStories->first()->user;
            // Newest first within each user (viewer opens on latest slide).
            $ordered = $userStories->sortByDesc('created_at')->values();
            return [
                'user_id' => $userGroupId,
                'user_handle' => $user->handle,
                'user_name' => $user->display_name,
                'avatar_url' => $user->avatar_url,
                'stories' => $ordered->map(function ($story) use ($hasViewer) {
                    $storyData = $story->toArray();
                    if ($hasViewer) {
                        $attrs = $story->getAttributes();
                        $storyData['has_viewed'] = array_key_exists('has_viewed', $attrs)
                            ? (bool) $attrs['has_viewed']
                            : false;
                        $storyData['user_reaction'] = $story->relationLoaded('reactions')
                            ? optional($story->reactions->first())->emoji
                            : null;
                    } else {
                        $storyData['has_viewed'] = false;
                        $storyData['user_reaction'] = null;
                    }
                    return $storyData;
                }),
            ];
        })->values();

        return response()->json($grouped);
    }

    /**
     * Get user's stories
     */
    public function getUserStories(Request $request, string $handle): JsonResponse
    {
        $decoded = trim(urldecode($handle));
        $user = User::query()
            ->whereRaw('LOWER(handle) = ?', [mb_strtolower($decoded)])
            ->first();

        if (!$user) {
            return response()->json(['errors' => ['handle' => ['User not found']]], 404);
        }

        $userId = $request->get('userId') ?: Auth::id();
        $hasViewer = !empty($userId);

        $query = Story::where('user_id', $user->id)
            ->active()
            ->withCount(['reactions', 'replies', 'views'])
            ->orderBy('created_at', 'desc');

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ])
            ->with(['reactions' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
                $q->select('story_id', 'emoji');
            }]);
        }

        $stories = $query->get();

        $transformedStories = $stories->map(function ($story) use ($hasViewer) {
            $storyData = $story->toArray();
            if ($hasViewer) {
                $attrs = $story->getAttributes();
                $storyData['has_viewed'] = array_key_exists('has_viewed', $attrs)
                    ? (bool) $attrs['has_viewed']
                    : false;
                $storyData['user_reaction'] = $story->relationLoaded('reactions')
                    ? optional($story->reactions->first())->emoji
                    : null;
            } else {
                $storyData['has_viewed'] = false;
                $storyData['user_reaction'] = null;
            }
            return $storyData;
        });

        return response()->json($transformedStories);
    }

    /**
     * Create a new story
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            \Log::warning('stories.store rejected: unauthenticated');
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $mediaUrl = $request->input('media_url', $request->input('mediaUrl'));
        $mediaType = $request->input('media_type', $request->input('mediaType', $request->input('type')));
        $text = $request->input('text');
        $stickers = $request->input('stickers');
        $poll = $request->input('poll');
        $question = $request->input('question');
        $textStyle = $request->input('textStyle', $request->input('text_style'));
        $taggedUsers = $request->input('taggedUsers', $request->input('tagged_users'));

        if (!is_string($text) || trim($text) === '') {
            if (is_array($poll) && !empty($poll['question'])) {
                $text = (string) $poll['question'];
            } elseif (is_string($question) && trim($question) !== '') {
                $text = $question;
            }
        }

        $payload = [
            'media_url' => is_string($mediaUrl) && $mediaUrl !== '' ? $mediaUrl : null,
            'media_type' => is_string($mediaType) && $mediaType !== '' ? $mediaType : null,
            'text' => is_string($text) && trim($text) !== '' ? $text : null,
            'text_color' => $request->input('text_color', $request->input('textColor')),
            'text_size' => $request->input('text_size', $request->input('textSize')),
            'location' => $request->input('location'),
            'venue' => $request->input('venue'),
            'shared_from_post_id' => $request->input('shared_from_post_id', $request->input('sharedFromPostId')),
            'shared_from_user_handle' => $request->input('shared_from_user_handle', $request->input('sharedFromUser')),
            'textStyle' => is_array($textStyle) ? $textStyle : null,
            'stickers' => is_array($stickers) ? $stickers : null,
            'taggedUsers' => is_array($taggedUsers) ? array_values(array_filter($taggedUsers, 'is_string')) : null,
        ];

        $validator = Validator::make($payload, [
            'media_url' => 'nullable|string|max:2048',
            'media_type' => 'nullable|in:image,video',
            'text' => 'nullable|string|max:2000',
            'text_color' => 'nullable|string|max:50',
            'text_size' => 'nullable|in:small,medium,large',
            'location' => 'nullable|string|max:200',
            'venue' => 'nullable|string|max:200',
            'shared_from_post_id' => 'nullable|uuid|exists:posts,id',
            'textStyle' => 'nullable|array',
            'textStyle.color' => 'nullable|string|max:50',
            'textStyle.size' => 'nullable|in:small,medium,large',
            'textStyle.background' => 'nullable|string|max:1000',
            'stickers' => 'nullable|array',
            'taggedUsers' => 'nullable|array',
            'taggedUsers.*' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            \Log::warning('stories.store validation failed', [
                'user_id' => $user->id,
                'errors' => $validator->errors()->toArray(),
            ]);
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $hasStickers = is_array($payload['stickers']) && count($payload['stickers']) > 0;
        if (!$payload['media_url'] && !$payload['text'] && !$hasStickers) {
            \Log::warning('stories.store rejected: empty story', ['user_id' => $user->id]);
            return response()->json(['error' => 'Story must have media, text, or stickers'], 400);
        }

        \Log::info('stories.store', [
            'user_id' => $user->id,
            'handle' => $user->handle,
            'has_media' => (bool) $payload['media_url'],
            'media_type' => $payload['media_type'],
            'has_text' => (bool) $payload['text'],
            'has_stickers' => $hasStickers,
        ]);

        $story = DB::transaction(function () use ($payload, $user) {
            $story = Story::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'media_url' => $payload['media_url'],
                'media_type' => $payload['media_type'],
                'text' => $payload['text'],
                'text_color' => $payload['text_color'],
                'text_size' => $payload['text_size'],
                'location' => $payload['location'],
                'venue' => $payload['venue'],
                'shared_from_post_id' => $payload['shared_from_post_id'],
                'shared_from_user_handle' => $payload['shared_from_post_id']
                    ? (Post::find($payload['shared_from_post_id'])?->user_handle
                        ?: $payload['shared_from_user_handle'])
                    : null,
                'text_style' => $payload['textStyle'],
                'stickers' => $payload['stickers'],
                'tagged_users' => $payload['taggedUsers'],
                'expires_at' => now('UTC')->addHours(24),
            ]);

            return $story->fresh() ?? $story;
        });

        \Log::info('stories.store created', [
            'story_id' => $story->id,
            'user_id' => $story->user_id,
            'user_handle' => $story->user_handle,
        ]);

        return response()->json($story, 201);
    }

    /**
     * View a story (increment view count)
     */
    public function view(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(['id' => $id], [
            'id' => 'required|uuid|exists:stories,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $story = Story::findOrFail($id);

        if ($story->isExpired()) {
            return response()->json(['error' => 'Story has expired'], 400);
        }

        DB::transaction(function () use ($user, $story) {
            // Create view if not exists (unique constraint prevents duplicates)
            StoryView::firstOrCreate([
                'story_id' => $story->id,
                'user_id' => $user->id,
            ]);

            $story->increment('views_count');
        });

        return response()->json(['success' => true]);
    }

    /**
     * Add reaction to story
     */
    public function addReaction(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['id' => $id]), [
            'id' => 'required|uuid|exists:stories,id',
            'emoji' => 'required|string|max:10'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $story = Story::findOrFail($id);

        if ($story->isExpired()) {
            return response()->json(['error' => 'Story has expired'], 400);
        }

        $reaction = DB::transaction(function () use ($user, $story, $request) {
            // Check if user already reacted
            $existingReaction = StoryReaction::where('story_id', $story->id)
                ->where('user_id', $user->id)
                ->first();

            if ($existingReaction) {
                // Update existing reaction
                $existingReaction->update(['emoji' => $request->emoji]);
                return $existingReaction;
            } else {
                // Create new reaction
                return StoryReaction::create([
                    'story_id' => $story->id,
                    'user_id' => $user->id,
                    'user_handle' => $user->handle,
                    'emoji' => $request->emoji,
                ]);
            }
        });

        return response()->json($reaction, 201);
    }

    /**
     * Add reply to story
     */
    public function addReply(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make(array_merge($request->all(), ['id' => $id]), [
            'id' => 'required|uuid|exists:stories,id',
            'text' => 'required|string|min:1|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $story = Story::findOrFail($id);

        if ($story->isExpired()) {
            return response()->json(['error' => 'Story has expired'], 400);
        }

        $reply = DB::transaction(function () use ($user, $story, $request) {
            return StoryReply::create([
                'story_id' => $story->id,
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text' => $request->text,
            ]);
        });

        return response()->json($reply, 201);
    }

    private function decodeStoryCursor(?string $cursor): array
    {
        $cursorValue = trim((string) ($cursor ?? ''));
        if ($cursorValue === '') {
            return ['created_at' => null, 'id' => null];
        }

        $encoded = strtr($cursorValue, '-_', '+/');
        $padding = strlen($encoded) % 4;
        if ($padding > 0) {
            $encoded .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($encoded, true);
        if ($decoded === false || !str_contains($decoded, '|')) {
            return ['created_at' => null, 'id' => null];
        }

        [$createdAtRaw, $id] = explode('|', $decoded, 2);
        if (!$id || !Str::isUuid($id)) {
            return ['created_at' => null, 'id' => null];
        }

        try {
            $createdAt = Carbon::parse($createdAtRaw)->toDateTimeString();
        } catch (\Throwable $e) {
            return ['created_at' => null, 'id' => null];
        }

        return ['created_at' => $createdAt, 'id' => $id];
    }

    private function encodeStoryCursor($createdAt, string $id): string
    {
        $createdAtString = $createdAt instanceof \DateTimeInterface
            ? $createdAt->format('Y-m-d H:i:s')
            : Carbon::parse((string) $createdAt)->format('Y-m-d H:i:s');
        return rtrim(strtr(base64_encode($createdAtString . '|' . $id), '+/', '-_'), '=');
    }
}

