<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoryResource;
use App\Models\Story;
use App\Models\StoryReaction;
use App\Models\StoryReply;
use App\Models\StoryView;
use App\Models\User;
use App\Models\Post;
use App\Services\LinkPreviewService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
        $userId = $this->resolveViewerId($request);
        $hasViewer = !empty($userId);

        $query = Story::active()
            ->with(['user:id,handle,display_name,avatar_url,is_private', 'reactions', 'replies'])
            ->withCount(['reactions', 'replies', 'views']);
        User::constrainAuthorVisibility($query, $userId);
        $query->visibleToAudience($userId);

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ]);
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

        $items = $stories->map(function ($story) use ($hasViewer, $userId) {
            return StoryResource::payload($story, $hasViewer, $hasViewer ? (string) $userId : null);
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
        $userId = $this->resolveViewerId($request);
        $hasViewer = !empty($userId);
        $query = Story::active()
            ->with(['user:id,handle,display_name,avatar_url,is_private', 'reactions', 'replies'])
            ->withCount(['reactions', 'replies', 'views']);
        User::constrainAuthorVisibility($query, $userId);
        $query->visibleToAudience($userId);

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ]);
        }

        $stories = $query->orderBy('created_at', 'desc')->get();

        // Group by user
        $grouped = $stories->groupBy('user_id')->map(function ($userStories, $userGroupId) use ($hasViewer, $userId) {
            $user = $userStories->first()->user;
            // Newest first within each user (viewer opens on latest slide).
            $ordered = $userStories->sortByDesc('created_at')->values();
            return [
                'user_id' => $userGroupId,
                'user_handle' => $user->handle,
                'user_name' => $user->display_name,
                'avatar_url' => $user->avatar_url,
                'stories' => $ordered->map(function ($story) use ($hasViewer, $userId) {
                    return StoryResource::payload($story, $hasViewer, $hasViewer ? (string) $userId : null);
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

        $userId = $this->resolveViewerId($request);
        $viewer = $userId ? User::query()->find($userId) : null;
        if (! $user->isVisibleTo($viewer instanceof User ? $viewer : null)) {
            return $this->privateProfileForbidden();
        }

        $hasViewer = !empty($userId);

        $query = Story::where('user_id', $user->id)
            ->active()
            ->with(['reactions', 'replies'])
            ->withCount(['reactions', 'replies', 'views'])
            ->orderBy('created_at', 'desc');
        $query->visibleToAudience($userId);

        if ($hasViewer) {
            $query->withExists([
                'views as has_viewed' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ]);
        }

        $stories = $query->get();

        $transformedStories = $stories->map(function ($story) use ($hasViewer, $userId) {
            return StoryResource::payload($story, $hasViewer, $hasViewer ? (string) $userId : null);
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
        $taggedUsersPositions = $request->input('taggedUsersPositions', $request->input('tagged_users_positions'));
        $audience = $request->input('audience', 'public');

        if (!is_string($text) || trim($text) === '') {
            if (is_array($poll) && !empty($poll['question'])) {
                $text = (string) $poll['question'];
            } elseif (is_string($question) && trim($question) !== '') {
                $text = $question;
            }
        }

        $normalizedPositions = null;
        if (is_array($taggedUsersPositions)) {
            $normalizedPositions = [];
            foreach ($taggedUsersPositions as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $handle = isset($row['handle']) ? trim((string) $row['handle']) : '';
                if ($handle === '') {
                    continue;
                }
                $normalizedPositions[] = [
                    'handle' => $handle,
                    'x' => isset($row['x']) ? (float) $row['x'] : 50.0,
                    'y' => isset($row['y']) ? (float) $row['y'] : 50.0,
                ];
            }
            if ($normalizedPositions === []) {
                $normalizedPositions = null;
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
            'taggedUsersPositions' => $normalizedPositions,
            'audience' => is_string($audience) ? strtolower(trim($audience)) : 'public',
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
            'taggedUsersPositions' => 'nullable|array',
            'taggedUsersPositions.*.handle' => 'required_with:taggedUsersPositions|string|max:100',
            'taggedUsersPositions.*.x' => 'nullable|numeric',
            'taggedUsersPositions.*.y' => 'nullable|numeric',
            'audience' => 'nullable|in:public,close_friends,only_me',
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

        if (! in_array($payload['audience'], ['public', 'close_friends', 'only_me'], true)) {
            $payload['audience'] = 'public';
        }

        // Prefer explicit location; else first location sticker label.
        if ((! is_string($payload['location']) || trim((string) $payload['location']) === '') && $hasStickers) {
            foreach ($payload['stickers'] as $sticker) {
                if (! is_array($sticker)) {
                    continue;
                }
                $category = strtolower((string) ($sticker['sticker']['category'] ?? $sticker['category'] ?? ''));
                $label = trim((string) ($sticker['textContent'] ?? $sticker['text_content'] ?? ''));
                if ($category === 'location' && $label !== '') {
                    $payload['location'] = $label;
                    break;
                }
            }
        }

        \Log::info('stories.store', [
            'user_id' => $user->id,
            'handle' => $user->handle,
            'has_media' => (bool) $payload['media_url'],
            'media_type' => $payload['media_type'],
            'has_text' => (bool) $payload['text'],
            'has_stickers' => $hasStickers,
            'audience' => $payload['audience'],
        ]);

        $linkSource = $payload['text'];
        if ((! is_string($linkSource) || trim($linkSource) === '') && $hasStickers) {
            foreach ($payload['stickers'] as $sticker) {
                if (! is_array($sticker)) {
                    continue;
                }
                $url = trim((string) ($sticker['linkUrl'] ?? $sticker['link_url'] ?? ''));
                if ($url !== '') {
                    $linkSource = $url;
                    break;
                }
            }
        }
        $linkPreview = app(LinkPreviewService::class)->previewFromText(
            is_string($linkSource) ? $linkSource : null
        );

        $story = DB::transaction(function () use ($payload, $user, $linkPreview) {
            $attrs = [
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'media_url' => $payload['media_url'],
                'media_type' => $payload['media_type'],
                'text' => $payload['text'],
                'text_color' => $payload['text_color'],
                'text_size' => $payload['text_size'],
                'location' => is_string($payload['location']) ? trim($payload['location']) ?: null : null,
                'venue' => is_string($payload['venue']) ? trim($payload['venue']) ?: null : $payload['venue'],
                'shared_from_post_id' => $payload['shared_from_post_id'],
                'shared_from_user_handle' => $payload['shared_from_post_id']
                    ? (Post::find($payload['shared_from_post_id'])?->user_handle
                        ?: $payload['shared_from_user_handle'])
                    : null,
                'text_style' => $payload['textStyle'],
                'stickers' => $payload['stickers'],
                'tagged_users' => $payload['taggedUsers'],
                'expires_at' => now('UTC')->addHours(24),
            ];
            if (Schema::hasColumn('stories', 'audience')) {
                $attrs['audience'] = $payload['audience'] ?: 'public';
            }
            if (Schema::hasColumn('stories', 'tagged_users_positions')) {
                $attrs['tagged_users_positions'] = $payload['taggedUsersPositions'];
            }
            if (Schema::hasColumn('stories', 'link_preview')) {
                $attrs['link_preview'] = $linkPreview;
            }
            $story = Story::create($attrs);

            return $story->fresh() ?? $story;
        });

        \Log::info('stories.store created', [
            'story_id' => $story->id,
            'user_id' => $story->user_id,
            'user_handle' => $story->user_handle,
        ]);

        $story->loadCount(['reactions', 'replies', 'views']);

        return response()->json(StoryResource::payload($story, false), 201);
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
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $story = Story::with('user')->findOrFail($id);
        if ($forbidden = $this->forbidUnlessStoryVisible($story, $user)) {
            return $forbidden;
        }

        if ($story->isExpired()) {
            return response()->json(['error' => 'Story has expired'], 400);
        }

        DB::transaction(function () use ($user, $story) {
            $view = StoryView::firstOrCreate([
                'story_id' => $story->id,
                'user_id' => $user->id,
            ]);

            if ($view->wasRecentlyCreated) {
                $story->increment('views_count');
            }
        });
        $story->refresh();

        return response()->json(array_merge(
            ['success' => true],
            $this->storyInteractionMetrics($story)
        ));
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
        $story = Story::with('user')->findOrFail($id);
        if ($forbidden = $this->forbidUnlessStoryVisible($story, $user instanceof User ? $user : null)) {
            return $forbidden;
        }

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

        return response()->json(array_merge($reaction->toArray(), $this->storyInteractionMetrics($story)), 201);
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
        $story = Story::with('user')->findOrFail($id);
        if ($forbidden = $this->forbidUnlessStoryVisible($story, $user instanceof User ? $user : null)) {
            return $forbidden;
        }

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

        return response()->json(array_merge($reply->toArray(), $this->storyInteractionMetrics($story)), 201);
    }

    /**
     * @return array{views_count: int, reactions_count: int, replies_count: int, reactions: array<int, array<string, mixed>>, replies: array<int, array<string, mixed>>}
     */
    private function storyInteractionMetrics(Story $story): array
    {
        $story->load(['reactions', 'replies']);
        $story->loadCount(['reactions', 'replies', 'views']);

        return [
            'views_count' => (int) ($story->views_count ?? 0),
            'reactions_count' => (int) ($story->reactions_count ?? 0),
            'replies_count' => (int) ($story->replies_count ?? 0),
            'reactions' => $story->reactions->map(fn ($reaction) => [
                'id' => $reaction->id,
                'user_id' => $reaction->user_id,
                'user_handle' => $reaction->user_handle,
                'emoji' => $reaction->emoji,
                'created_at' => $reaction->created_at,
            ])->values()->all(),
            'replies' => $story->replies->map(fn ($reply) => [
                'id' => $reply->id,
                'user_id' => $reply->user_id,
                'user_handle' => $reply->user_handle,
                'text' => $reply->text,
                'created_at' => $reply->created_at,
            ])->values()->all(),
        ];
    }

    private function resolveViewerId(Request $request): ?string
    {
        if (Auth::check()) {
            return (string) Auth::id();
        }
        $userId = (string) $request->get('userId', '');

        return $userId !== '' ? $userId : null;
    }

    private function privateProfileForbidden(): JsonResponse
    {
        return response()->json([
            'error' => 'Profile is private',
            'is_private' => true,
            'can_view' => false,
            'requires_follow' => true,
        ], 403);
    }

    private function forbidUnlessStoryVisible(Story $story, ?User $viewer): ?JsonResponse
    {
        $author = $story->relationLoaded('user') ? $story->user : User::query()->find($story->user_id);
        if (! $author instanceof User) {
            return response()->json(['error' => 'Story not found'], 404);
        }
        if (! $author->isVisibleTo($viewer)) {
            return $this->privateProfileForbidden();
        }

        $audience = strtolower((string) ($story->audience ?? 'public'));
        if ($audience === '' || $audience === 'public') {
            return null;
        }
        if ($viewer instanceof User && (string) $viewer->id === (string) $story->user_id) {
            return null;
        }
        if ($audience === 'only_me') {
            return $this->privateProfileForbidden();
        }
        if ($audience === 'close_friends') {
            $isFollower = $viewer instanceof User
                && DB::table('user_follows')
                    ->where('follower_id', $viewer->id)
                    ->where('following_id', $story->user_id)
                    ->where('status', 'accepted')
                    ->exists();
            if (! $isFollower) {
                return $this->privateProfileForbidden();
            }
        }

        return null;
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

