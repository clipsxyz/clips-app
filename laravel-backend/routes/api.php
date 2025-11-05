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

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    // Posts routes
    Route::prefix('posts')->group(function () {
        Route::get('/', [PostController::class, 'index']);
        Route::post('/', [PostController::class, 'store']);
        Route::get('/{id}', [PostController::class, 'show']);
        Route::post('/{id}/like', [PostController::class, 'toggleLike']);
        Route::post('/{id}/view', [PostController::class, 'incrementView']);
        Route::post('/{id}/share', [PostController::class, 'share']);
        Route::post('/{id}/reclip', [PostController::class, 'reclip']);
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
        Route::get('/{handle}/followers', [UserController::class, 'followers']);
        Route::get('/{handle}/following', [UserController::class, 'following']);
    });

    // Upload routes
    Route::prefix('upload')->group(function () {
        Route::post('/single', [UploadController::class, 'single']);
        Route::post('/multiple', [UploadController::class, 'multiple']);
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
});
