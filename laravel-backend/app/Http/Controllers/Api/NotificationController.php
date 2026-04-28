<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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

        $items = $query->limit($limit)->get();
        $last = $items->last();
        $nextCursor = null;
        if ($items->count() === $limit && $last) {
            $nextCursor = $this->encodeCursor($last->created_at->format('Y-m-d H:i:s'), (string) $last->id);
        }

        return response()->json([
            'items' => $items,
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
            'userId' => 'required|string',
            'userHandle' => 'required|string',
            'remove' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            if ($request->boolean('remove')) {
                DB::table('fcm_tokens')
                    ->where('user_id', $request->userId)
                    ->where('user_handle', $request->userHandle)
                    ->where('token', $request->token)
                    ->delete();

                return response()->json([
                    'success' => true,
                    'message' => 'FCM token removed successfully'
                ]);
            }

            // Store FCM token in database
            // You can create a migration for this table: fcm_tokens
            DB::table('fcm_tokens')->updateOrInsert(
                [
                    'user_id' => $request->userId,
                    'user_handle' => $request->userHandle,
                ],
                [
                    'token' => $request->token,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

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
     * Save notification preferences for a user
     */
    public function savePreferences(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'userId' => 'required|string',
            'userHandle' => 'required|string',
            'preferences' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Store notification preferences in database
            // You can create a migration for this table: notification_preferences
            DB::table('notification_preferences')->updateOrInsert(
                [
                    'user_id' => $request->userId,
                    'user_handle' => $request->userHandle,
                ],
                [
                    'preferences' => json_encode($request->preferences),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Notification preferences saved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error saving preferences: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get notification preferences for a user
     */
    public function getPreferences(Request $request, $userHandle)
    {
        try {
            $prefs = DB::table('notification_preferences')
                ->where('user_handle', $userHandle)
                ->first();

            if ($prefs) {
                return response()->json([
                    'success' => true,
                    'preferences' => json_decode($prefs->preferences, true)
                ]);
            }

            return response()->json([
                'success' => true,
                'preferences' => null
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching preferences: ' . $e->getMessage()
            ], 500);
        }
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
}
