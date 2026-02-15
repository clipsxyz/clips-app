<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Post;
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
use App\Http\Controllers\Api\BoostController;

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

// Dev: ensure a "Boost Test" user exists with one post – use these credentials to test boost flow
Route::get('/dev/boost-test-user', function () {
    try {
        $user = User::firstOrCreate(
            ['email' => 'boosttest@example.com'],
            [
                'username' => 'boosttest',
                'password' => Hash::make('password123'),
                'display_name' => 'Boost Test',
                'handle' => 'BoostTest@Dublin',
                'location_local' => 'Dublin',
                'location_regional' => 'Dublin',
                'location_national' => 'Ireland',
            ]
        );
        $post = Post::where('user_id', $user->id)->first();
        if (!$post) {
            $post = Post::create([
                'user_id' => $user->id,
                'user_handle' => $user->handle,
                'text_content' => 'This is a test post – use it to try the Boost flow!',
                'location_label' => 'Dublin',
                'likes_count' => 0,
                'views_count' => 0,
                'comments_count' => 0,
            ]);
        }
        return response()->json([
            'message' => 'Use these credentials to log in, then go to Boost and boost this post.',
            'email' => 'boosttest@example.com',
            'password' => 'password123',
            'handle' => $user->handle,
            'post_id' => $post->id,
            'steps' => ['1. Log in with the email and password above', '2. Go to Boost tab', '3. Tap Boost on the test post', '4. Choose a tier and Continue to Payment', '5. Fill the form and Pay (mock – no real charge)'],
        ]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
    }
});

// Boost prices from config (for display or to keep frontend in sync; no auth)
Route::get('/boost/prices', function () {
    return response()->json([
        'currency' => config('boost.currency'),
        'prices' => config('boost.prices'),
        'amounts_cents' => config('boost.amounts_cents'),
    ]);
});

// Create Stripe PaymentIntent for boost (no auth required for demo; add auth middleware in production)
Route::post('/boost/create-payment-intent', [BoostController::class, 'createPaymentIntent']);

// Activate boost after Stripe payment (verifies PaymentIntent with Stripe)
Route::post('/boost/activate', [BoostController::class, 'activate']);

// Get active boosted post IDs for feed merging (public)
Route::get('/boost/active-ids', [BoostController::class, 'activeIds']);

// Get boost status for a single post
Route::get('/boost/status/{postId}', [BoostController::class, 'status']);

// Stripe sandbox config check (no auth – so you can verify keys without logging in)
Route::get('/boost/stripe-status', function () {
    $secret = config('services.stripe.secret');
    $key = config('services.stripe.key');
    $hasSecret = !empty($secret) && is_string($secret);
    $hasPublishable = !empty($key) && is_string($key);
    $secretIsTest = $hasSecret && str_starts_with($secret, 'sk_test_');
    return response()->json([
        'configured' => $hasSecret && $hasPublishable,
        'mode' => $secretIsTest ? 'test' : 'live',
        'publishable_key_set' => $hasPublishable,
        'secret_key_set' => $hasSecret,
        'message' => $hasSecret && $hasPublishable
            ? ($secretIsTest ? 'Stripe test (sandbox) keys are loaded. Use test cards when you add real payments.' : 'Stripe live keys are loaded.')
            : 'Add STRIPE_KEY and STRIPE_SECRET to laravel-backend/.env',
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

// Dev helper: make Ava@galway follow Barry so mutual-follow DM icon can be tested (open in browser)
Route::get('/dev/ava-follows-barry', function () {
    $barry = User::whereRaw('LOWER(handle) LIKE ?', ['%barry%'])->first();
    $ava = User::whereRaw('LOWER(handle) = ?', ['ava@galway'])->first();
    if (!$ava) {
        $ava = User::firstOrCreate(
            ['handle' => 'Ava@galway'],
            [
                'username' => 'ava_galway',
                'email' => 'ava.galway@example.com',
                'password' => Hash::make('password123'),
                'display_name' => 'Ava',
                'location_local' => 'Galway City',
                'location_regional' => 'Galway',
                'location_national' => 'Ireland',
            ]
        );
    }
    if (!$barry || !$ava || $barry->id === $ava->id) {
        return response()->json([
            'ok' => false,
            'message' => 'Need a user with "barry" in handle (e.g. Barry@Cork). Create Barry@Cork in the app first.',
            'handles' => User::pluck('handle')->toArray(),
        ], 400);
    }
    $alreadyFollows = $barry->followers()->where('follower_id', $ava->id)->exists();
    if ($alreadyFollows) {
        return response()->json([
            'ok' => true,
            'message' => "Ava ({$ava->handle}) already follows Barry ({$barry->handle}). As Barry, follow Ava back to see the DM icon (mutual follow).",
            'barry' => $barry->handle,
            'ava' => $ava->handle,
        ]);
    }
    $barry->followers()->attach($ava->id, ['status' => 'accepted']);
    $ava->increment('following_count');
    $barry->increment('followers_count');
    return response()->json([
        'ok' => true,
        'message' => "Ava ({$ava->handle}) now follows Barry ({$barry->handle}). As Barry@Cork, follow Ava@galway back in the app – then you'll see the DM icon (mutual follow).",
        'barry' => $barry->handle,
        'ava' => $ava->handle,
    ]);
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
        Route::delete('/{id}', [PostController::class, 'destroy']);
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
        Route::get('/check-follows-me', [UserController::class, 'checkFollowsMe']);
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
        // FCM token and preferences routes
        Route::post('/fcm-token', [NotificationController::class, 'saveFCMToken']);
        Route::post('/preferences', [NotificationController::class, 'savePreferences']);
        Route::get('/preferences/{userHandle}', [NotificationController::class, 'getPreferences']);
    });

    // Messages routes
    Route::prefix('messages')->group(function () {
        Route::get('/conversations', [MessageController::class, 'getConversations']);
        Route::get('/conversation/{otherHandle}', [MessageController::class, 'getConversation']);
        Route::post('/send', [MessageController::class, 'sendMessage']);
        Route::post('/conversation/{otherHandle}/read', [MessageController::class, 'markConversationRead']);
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
