<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\StoryController;
use App\Http\Controllers\Api\CollectionController;
use App\Http\Controllers\Api\MusicController;
use App\Http\Controllers\Api\MusicLibraryController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'OK',
        'timestamp' => now()->toISOString(),
        'environment' => app()->environment()
    ]);
});

// Public search and location routes
Route::get('/locations/search', [LocationController::class, 'search']);
Route::get('/search', [SearchController::class, 'unified']);

// Public routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Public music routes (no auth required)
Route::prefix('music')->group(function () {
    Route::post('/generate', [MusicController::class, 'generate']); // Generate AI music (public)
    Route::get('/library', [MusicLibraryController::class, 'index']); // Get music library (public - license-safe tracks only)
    Route::get('/library/{id}', [MusicLibraryController::class, 'show']); // Get single library track (public)
    Route::get('/file/{id}', [MusicLibraryController::class, 'serveFile']); // Serve music file for preview (public)
});

// Public upload routes (allow unauthenticated for video editing workflow)
Route::prefix('upload')->group(function () {
    Route::post('/single', [UploadController::class, 'single']);
    Route::post('/multiple', [UploadController::class, 'multiple']);
});

// Public posts routes (allow viewing posts without auth)
Route::prefix('posts')->group(function () {
    Route::get('/', [PostController::class, 'index']); // Public - anyone can view feed
    Route::get('/{id}', [PostController::class, 'show']); // Public - anyone can view single post
    Route::post('/{id}/view', [PostController::class, 'incrementView']); // Public - track views without auth
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    // Posts routes (protected - require auth for actions)
    Route::prefix('posts')->group(function () {
        Route::post('/', [PostController::class, 'store']);
        Route::put('/{id}', [PostController::class, 'update']);
        Route::post('/{id}/like', [PostController::class, 'toggleLike']);
        Route::post('/{id}/share', [PostController::class, 'share']);
        Route::post('/{id}/reclip', [PostController::class, 'reclip']);
    });

    // Render jobs routes (for checking status)
    Route::prefix('render-jobs')->group(function () {
        Route::get('/{id}', function (string $id) {
            $job = \App\Models\RenderJob::findOrFail($id);
            
            // Ensure user can only access their own jobs
            if ($job->user_id !== Auth::id()) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
            
            return response()->json([
                'id' => $job->id,
                'status' => $job->status,
                'finalVideoUrl' => $job->status === 'completed' ? $job->final_video_url : null,
                'errorMessage' => $job->status === 'failed' ? $job->error_message : null,
                'createdAt' => $job->created_at,
                'updatedAt' => $job->updated_at,
            ]);
        });
    });

    // Comments routes
    Route::prefix('comments')->group(function () {
        Route::get('/post/{postId}', [CommentController::class, 'getPostComments']);
        Route::post('/post/{postId}', [CommentController::class, 'store']);
        Route::post('/reply/{parentId}', [CommentController::class, 'reply']);
        Route::post('/{id}/like', [CommentController::class, 'toggleLike']);
    });

    // Users routes
    Route::prefix('users')->group(function () {
        Route::get('/{handle}', [UserController::class, 'show']);
        Route::post('/{handle}/follow', [UserController::class, 'toggleFollow']);
        Route::post('/{handle}/follow/accept', [UserController::class, 'acceptFollowRequest']);
        Route::post('/{handle}/follow/deny', [UserController::class, 'denyFollowRequest']);
        Route::get('/{handle}/followers', [UserController::class, 'followers']);
        Route::get('/{handle}/following', [UserController::class, 'following']);
        Route::post('/privacy/toggle', [UserController::class, 'togglePrivacy']);
    });

    // Notifications routes
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/{id}/read', [NotificationController::class, 'markRead']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllRead']);
    });

    // Messages routes
    Route::prefix('messages')->group(function () {
        Route::get('/conversations', [MessageController::class, 'getConversations']);
        Route::get('/conversation/{otherHandle}', [MessageController::class, 'getConversation']);
        Route::post('/send', [MessageController::class, 'sendMessage']);
    });

    // Stories routes
    Route::prefix('stories')->group(function () {
        Route::get('/', [StoryController::class, 'index']);
        Route::get('/user/{handle}', [StoryController::class, 'getUserStories']);
        Route::post('/', [StoryController::class, 'store']);
        Route::post('/{id}/view', [StoryController::class, 'view']);
        Route::post('/{id}/reaction', [StoryController::class, 'addReaction']);
        Route::post('/{id}/reply', [StoryController::class, 'addReply']);
    });

    // Collections routes
    Route::prefix('collections')->group(function () {
        Route::get('/', [CollectionController::class, 'index']);
        Route::post('/', [CollectionController::class, 'store']);
        Route::get('/{id}', [CollectionController::class, 'show']);
        Route::put('/{id}', [CollectionController::class, 'update']);
        Route::delete('/{id}', [CollectionController::class, 'destroy']);
        Route::post('/{id}/posts', [CollectionController::class, 'addPost']);
        Route::delete('/{id}/posts', [CollectionController::class, 'removePost']);
        Route::get('/post/{postId}', [CollectionController::class, 'getCollectionsForPost']);
        Route::get('/{id}/posts', [CollectionController::class, 'getCollectionPosts']);
    });

    // Music routes (protected - require auth)
    Route::prefix('music')->group(function () {
        Route::get('/{id}', [MusicController::class, 'show']); // Get single track (AI or library)
        Route::post('/upload', [MusicController::class, 'upload']); // Upload custom audio
        Route::post('/{id}/use', [MusicController::class, 'incrementUsage']); // Increment usage count
    });
});
