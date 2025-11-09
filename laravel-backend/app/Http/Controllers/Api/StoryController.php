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

class StoryController extends Controller
{
    /**
     * Get all active stories grouped by user
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->get('userId');
        $query = Story::active()
            ->with(['user:id,handle,display_name,avatar_url'])
            ->withCount(['reactions', 'replies', 'views']);

        if ($userId) {
            $query->with(['views' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['reactions' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }]);
        }

        $stories = $query->orderBy('created_at', 'desc')->get();

        // Group by user
        $grouped = $stories->groupBy('user_id')->map(function ($userStories, $userGroupId) use ($userId) {
            $user = $userStories->first()->user;
            return [
                'user_id' => $userGroupId,
                'user_handle' => $user->handle,
                'user_name' => $user->display_name,
                'avatar_url' => $user->avatar_url,
                'stories' => $userStories->map(function ($story) use ($userId) {
                    $storyData = $story->toArray();
                    if ($userId) {
                        $storyData['has_viewed'] = $story->hasBeenViewedBy(User::find($userId));
                        $storyData['user_reaction'] = $story->getUserReaction(User::find($userId))?->emoji;
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
        $validator = Validator::make(['handle' => $handle], [
            'handle' => 'required|string|exists:users,handle'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = User::where('handle', $handle)->firstOrFail();
        $userId = $request->get('userId');

        $query = Story::where('user_id', $user->id)
            ->active()
            ->withCount(['reactions', 'replies', 'views'])
            ->orderBy('created_at', 'desc');

        if ($userId) {
            $query->with(['views' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->with(['reactions' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }]);
        }

        $stories = $query->get();

        $transformedStories = $stories->map(function ($story) use ($userId) {
            $storyData = $story->toArray();
            if ($userId) {
                $storyData['has_viewed'] = $story->hasBeenViewedBy(User::find($userId));
                $storyData['user_reaction'] = $story->getUserReaction(User::find($userId))?->emoji;
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
        $validator = Validator::make($request->all(), [
            'media_url' => 'nullable|url|max:500', // Made nullable for text-only stories
            'media_type' => 'nullable|in:image,video', // Made nullable for text-only stories
            'text' => 'nullable|string|max:200',
            'text_color' => 'nullable|string|max:50',
            'text_size' => 'nullable|in:small,medium,large',
            'location' => 'nullable|string|max:200',
            'shared_from_post_id' => 'nullable|uuid|exists:posts,id',
            'textStyle' => 'nullable|array',
            'textStyle.color' => 'nullable|string|max:50',
            'textStyle.size' => 'nullable|in:small,medium,large',
            'textStyle.background' => 'nullable|string|max:200',
            'stickers' => 'nullable|array',
            'taggedUsers' => 'nullable|array',
            'taggedUsers.*' => 'required|string|exists:users,handle',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        // Validate that either media or text/stickers are provided
        if (!$request->media_url && !$request->text && (!$request->stickers || count($request->stickers) === 0)) {
            return response()->json(['error' => 'Story must have media, text, or stickers'], 400);
        }

        $user = Auth::user();

        $story = DB::transaction(function () use ($request, $user) {
            $story = Story::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'media_url' => $request->media_url,
                'media_type' => $request->media_type,
                'text' => $request->text,
                'text_color' => $request->text_color,
                'text_size' => $request->text_size,
                'location' => $request->location,
                'shared_from_post_id' => $request->shared_from_post_id,
                'shared_from_user_handle' => $request->shared_from_post_id 
                    ? Post::find($request->shared_from_post_id)?->user_handle 
                    : null,
                'text_style' => $request->textStyle,
                'stickers' => $request->stickers,
                'tagged_users' => $request->taggedUsers,
                'expires_at' => now()->addHours(24), // 24 hours from now
            ]);

            return $story;
        });

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
}

