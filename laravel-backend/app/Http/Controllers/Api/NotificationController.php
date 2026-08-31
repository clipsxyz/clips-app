<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserNotificationSetting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    /**
     * List notifications for authenticated user with keyset cursor pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cursor' => 'nullable|string',
            'limit' => 'integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $limit = (int) $request->get('limit', 20);
        $cursorState = $this->decodeCursor((string) $request->get('cursor', ''));

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($cursorState['created_at'] && $cursorState['id']) {
            $query->where(function ($q) use ($cursorState) {
                $q->where('created_at', '<', $cursorState['created_at'])
                    ->orWhere(function ($q2) use ($cursorState) {
                        $q2->where('created_at', '=', $cursorState['created_at'])
                            ->where('id', '<', $cursorState['id']);
                    });
            });
        }

        $items = $query->with(['chatGroupInvite.chatGroup'])->limit($limit)->get();
        $last = $items->last();
        $nextCursor = null;
        if ($items->count() === $limit && $last) {
            $nextCursor = $this->encodeCursor($last->created_at->format('Y-m-d H:i:s'), (string) $last->id);
        }

        $payload = $items->map(function (Notification $n) {
            $group = $n->chatGroupInvite?->chatGroup;
            $row = $n->toArray();
            $row['chat_group_invite_id'] = $n->chat_group_invite_id;
            $row['chat_group_id'] = $group?->id;
            $row['group_name'] = $group?->name;

            return $row;
        });

        return response()->json([
            'items' => $payload,
            'nextCursor' => $nextCursor,
            'hasMore' => $nextCursor !== null,
        ]);
    }

    /**
     * Get unread notifications count for current user.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = Auth::user();
        $count = Notification::query()
            ->where('user_id', $user->id)
            ->where('read', false)
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark one notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        $notification = Notification::query()
            ->where('user_id', $user->id)
            ->where('id', $id)
            ->first();

        if (!$notification) {
            return response()->json(['error' => 'Notification not found'], 404);
        }

        $notification->update(['read' => true]);

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = Auth::user();
        Notification::query()
            ->where('user_id', $user->id)
            ->where('read', false)
            ->update(['read' => true]);

        return response()->json(['success' => true]);
    }

    /**
     * Save FCM token for a user
     */
    public function saveFCMToken(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
            'userId' => 'nullable|string',
            'userHandle' => 'nullable|string',
            'remove' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $authUser = Auth::user();
            $userId = trim((string) ($authUser?->id ?? $request->input('userId', '')));
            $userHandle = trim((string) ($authUser?->handle ?? $request->input('userHandle', '')));
            $token = trim((string) $request->input('token', ''));

            if ($token === '') {
                return response()->json(['success' => false, 'message' => 'token required'], 422);
            }

            if ($request->boolean('remove')) {
                $q = DB::table('fcm_tokens')->where('token', $token);
                if ($userId !== '') {
                    $q->where('user_id', $userId);
                }
                $deleted = $q->delete();
                $pruned = $this->pruneRotatedTokens($userId, $token);

                Log::info('FCM token removed', [
                    'user_id' => $userId,
                    'user_handle' => $userHandle,
                    'token_prefix' => substr($token, 0, 12),
                    'deleted' => $deleted,
                    'pruned_rotated' => $pruned,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'FCM token removed successfully'
                ]);
            }

            if ($userId === '' || strtolower($userId) === 'unknown') {
                return response()->json([
                    'success' => false,
                    'message' => 'Authenticated user required to register FCM token',
                ], 401);
            }

            DB::table('fcm_tokens')->updateOrInsert(
                ['token' => $token],
                [
                    'user_id' => $userId,
                    'user_handle' => $userHandle !== '' ? $userHandle : (string) ($authUser?->handle ?? ''),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $this->pruneRotatedTokens($userId, $token);

            Log::info('FCM token registered', [
                'user_id' => $userId,
                'user_handle' => $userHandle !== '' ? $userHandle : (string) ($authUser?->handle ?? ''),
                'token_prefix' => substr($token, 0, 12),
            ]);

            // Drop stale anonymous placeholders from earlier cold starts.
            DB::table('fcm_tokens')
                ->where('user_id', 'unknown')
                ->where('token', $token)
                ->delete();

            return response()->json([
                'success' => true,
                'message' => 'FCM token saved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error saving FCM token: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Save notification preferences for the authenticated user.
     */
    public function savePreferences(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'userId' => 'nullable|string',
            'userHandle' => 'nullable|string',
            'preferences' => 'required|array',
            'preferences.enabled' => 'sometimes|boolean',
            'preferences.directMessages' => 'sometimes|boolean',
            'preferences.groupChats' => 'sometimes|boolean',
            'preferences.likes' => 'sometimes|boolean',
            'preferences.comments' => 'sometimes|boolean',
            'preferences.replies' => 'sometimes|boolean',
            'preferences.follows' => 'sometimes|boolean',
            'preferences.followRequests' => 'sometimes|boolean',
            'preferences.storyInsights' => 'sometimes|boolean',
            'preferences.questions' => 'sometimes|boolean',
            'preferences.shares' => 'sometimes|boolean',
            'preferences.reclips' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        try {
            $incoming = UserNotificationSetting::sanitizeClientPreferences(
                (array) $request->input('preferences', [])
            );
            $setting = UserNotificationSetting::query()->firstOrNew(['user_id' => $user->id]);
            $merged = array_merge(
                UserNotificationSetting::defaultClientPreferences(),
                $setting->exists ? $setting->toClientPreferences() : [],
                $incoming
            );
            $setting->user_id = $user->id;
            $setting->fillFromClient($merged);
            $setting->save();

            if (Schema::hasTable('notification_preferences')) {
                DB::table('notification_preferences')->updateOrInsert(
                    [
                        'user_id' => (string) $user->id,
                        'user_handle' => (string) $user->handle,
                    ],
                    [
                        'preferences' => json_encode($merged),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Notification preferences saved successfully',
                'preferences' => $setting->toClientPreferences(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error saving preferences: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get notification preferences for the authenticated user.
     */
    public function getPreferences(Request $request)
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        return response()->json($this->preferencesPayloadForUser($user));
    }

    /**
     * Get notification preferences for a handle (own handle only; others return null).
     */
    public function getPreferencesForHandle(Request $request, $userHandle)
    {
        $authUser = Auth::user();
        if (! $authUser instanceof User) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        $normalized = strtolower(ltrim(trim((string) $userHandle), '@'));
        $own = strtolower(ltrim(trim((string) $authUser->handle), '@'));
        if ($normalized === '' || $normalized !== $own) {
            return response()->json([
                'success' => true,
                'preferences' => null,
            ]);
        }

        return response()->json($this->preferencesPayloadForUser($authUser));
    }

    /**
     * @return array{success: true, preferences: array<string, bool>}
     */
    private function preferencesPayloadForUser(User $user): array
    {
        $setting = UserNotificationSetting::query()->where('user_id', $user->id)->first();

        return [
            'success' => true,
            'preferences' => $setting
                ? $setting->toClientPreferences()
                : UserNotificationSetting::defaultClientPreferences(),
        ];
    }

    private function decodeCursor(?string $cursor): array
    {
        $cursorValue = trim((string) ($cursor ?? ''));
        if ($cursorValue === '' || $cursorValue === '0') {
            return ['created_at' => null, 'id' => null];
        }

        if (ctype_digit($cursorValue)) {
            // Legacy offset-like cursors are treated as first page.
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

        [$createdAt, $id] = explode('|', $decoded, 2);
        if (!$createdAt || !$id || !Str::isUuid($id)) {
            return ['created_at' => null, 'id' => null];
        }

        return ['created_at' => $createdAt, 'id' => $id];
    }

    private function encodeCursor(string $createdAt, string $id): string
    {
        return rtrim(strtr(base64_encode($createdAt . '|' . $id), '+/', '-_'), '=');
    }

    /**
     * Drop older FCM tokens from the same app install (same instance id prefix).
     * Keeps other devices: their instance ids differ.
     */
    private function pruneRotatedTokens(string $userId, string $token): int
    {
        if ($userId === '' || strtolower($userId) === 'unknown' || ! str_contains($token, ':')) {
            return 0;
        }
        $instanceId = Str::before($token, ':');
        if ($instanceId === '') {
            return 0;
        }

        return DB::table('fcm_tokens')
            ->where('user_id', $userId)
            ->where('token', '!=', $token)
            ->where('token', 'like', $instanceId.':%')
            ->delete();
    }
}
