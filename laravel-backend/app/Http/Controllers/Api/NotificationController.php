<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class NotificationController extends Controller
{
    /**
     * Save FCM token for a user
     */
    public function saveFCMToken(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
            'userId' => 'required|string',
            'userHandle' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
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
}
