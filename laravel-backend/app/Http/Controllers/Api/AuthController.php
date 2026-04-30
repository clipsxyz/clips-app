<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    /**
     * Register new user
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|min:3|max:50|unique:users,username|regex:/^[a-zA-Z0-9_]+$/',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(6)],
            'displayName' => 'required|string|min:1|max:100',
            'handle' => 'required|string|min:3|max:100|unique:users,handle|regex:/^[a-zA-Z0-9@]+$/',
            'locationLocal' => 'nullable|string|max:100',
            'locationRegional' => 'nullable|string|max:100',
            'locationNational' => 'nullable|string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = DB::transaction(function () use ($request) {
            $user = User::create([
                'username' => $request->username,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'display_name' => $request->displayName,
                'handle' => $request->handle,
                'location_local' => $request->locationLocal,
                'location_regional' => $request->locationRegional,
                'location_national' => $request->locationNational,
            ]);

            return $user;
        });

        // Generate token
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user->makeHidden(['password']),
            'token' => $token
        ], 201);
    }

    /**
     * Login user
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // Generate token
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user->makeHidden(['password']),
            'token' => $token
        ]);
    }

    /**
     * Get current user profile
     */
    public function me(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        return response()->json($user->makeHidden(['password']));
    }

    /**
     * Update the authenticated user's profile (bio, locations, places traveled, social links).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'display_name' => 'sometimes|string|min:1|max:100',
            'bio' => 'sometimes|nullable|string|max:5000',
            'places_traveled' => 'sometimes|nullable|array|max:80',
            'places_traveled.*' => 'string|max:200',
            'location_local' => 'sometimes|nullable|string|max:100',
            'location_regional' => 'sometimes|nullable|string|max:100',
            'location_national' => 'sometimes|nullable|string|max:100',
            'social_links' => 'sometimes|nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = $validator->validated();
        $fillable = ['display_name', 'bio', 'places_traveled', 'location_local', 'location_regional', 'location_national', 'social_links'];
        foreach ($fillable as $field) {
            if (array_key_exists($field, $data)) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        // Bust suggested-by-places cache for this user (version bump; works on file/redis drivers)
        $vk = 'user_profile_sig_version:'.$user->id;
        Cache::put($vk, (int) Cache::get($vk, 0) + 1, now()->addDays(365));

        return response()->json($user->makeHidden(['password'])->fresh());
    }

    /**
     * Send a 6-digit OTP to a phone number (or return debug code in local/dev fallback).
     */
    public function sendPhoneCode(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'phone' => ['required', 'string', 'regex:/^\+[1-9]\d{7,14}$/'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $phone = (string) $request->input('phone');
        $otpCode = (string) random_int(100000, 999999);
        $expiresAt = now()->addMinutes(10);

        $cacheKey = 'phone_otp:user:' . $user->id;
        $cachePayload = [
            'phone' => $phone,
            'code_hash' => hash('sha256', $otpCode),
            'attempts' => 0,
            'expires_at' => $expiresAt->toISOString(),
        ];
        Cache::put($cacheKey, $cachePayload, $expiresAt);

        $twilioSid = (string) config('services.twilio.sid', '');
        $twilioToken = (string) config('services.twilio.token', '');
        $otpChannel = strtolower((string) config('services.twilio.otp_channel', 'whatsapp'));
        if (!in_array($otpChannel, ['whatsapp', 'sms'], true)) {
            $otpChannel = 'whatsapp';
        }
        $twilioFrom = $otpChannel === 'whatsapp'
            ? (string) config('services.twilio.whatsapp_from', '')
            : (string) config('services.twilio.from', '');
        $twilioConfigured = $twilioSid !== '' && $twilioToken !== '' && $twilioFrom !== '';

        $delivery = 'mock';
        if ($twilioConfigured) {
            $to = $otpChannel === 'whatsapp' ? "whatsapp:{$phone}" : $phone;
            $from = $otpChannel === 'whatsapp'
                ? (str_starts_with($twilioFrom, 'whatsapp:') ? $twilioFrom : "whatsapp:{$twilioFrom}")
                : $twilioFrom;
            $res = Http::asForm()
                ->withBasicAuth($twilioSid, $twilioToken)
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/Messages.json", [
                    'From' => $from,
                    'To' => $to,
                    'Body' => "Your Clips verification code is {$otpCode}",
                ]);

            if ($res->successful()) {
                $delivery = $otpChannel;
            } else {
                Log::warning('Twilio OTP send failed', [
                    'channel' => $otpChannel,
                    'status' => $res->status(),
                    'body' => $res->body(),
                ]);
                if (app()->environment('production')) {
                    return response()->json(['error' => 'Failed to send verification code'], 502);
                }
            }
        }

        $response = [
            'ok' => true,
            'delivery' => $delivery,
            'expires_in_seconds' => 600,
        ];

        if ($delivery === 'mock') {
            $response['debug_code'] = $otpCode;
        }

        return response()->json($response);
    }

    /**
     * Verify the OTP and mark the authenticated user's phone as verified.
     */
    public function verifyPhoneCode(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'phone' => ['required', 'string', 'regex:/^\+[1-9]\d{7,14}$/'],
            'code' => ['required', 'digits:6'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $phone = (string) $request->input('phone');
        $code = (string) $request->input('code');
        $cacheKey = 'phone_otp:user:' . $user->id;
        $payload = Cache::get($cacheKey);

        if (!is_array($payload) || empty($payload['phone']) || empty($payload['code_hash'])) {
            return response()->json(['error' => 'Verification code expired. Please request a new one.'], 422);
        }

        if ((string) $payload['phone'] !== $phone) {
            return response()->json(['error' => 'Phone number does not match the requested verification.'], 422);
        }

        $attempts = (int) ($payload['attempts'] ?? 0);
        if ($attempts >= 5) {
            Cache::forget($cacheKey);
            return response()->json(['error' => 'Too many incorrect attempts. Please request a new code.'], 429);
        }

        $expectedHash = (string) $payload['code_hash'];
        $givenHash = hash('sha256', $code);
        if (!hash_equals($expectedHash, $givenHash)) {
            $payload['attempts'] = $attempts + 1;
            Cache::put($cacheKey, $payload, now()->addMinutes(10));
            return response()->json(['error' => 'Incorrect verification code.'], 422);
        }

        $user->phone_number = $phone;
        $user->phone_verified_at = now();
        $user->save();
        Cache::forget($cacheKey);

        return response()->json([
            'ok' => true,
            'phone_number' => $user->phone_number,
            'phone_verified_at' => optional($user->phone_verified_at)->toISOString(),
        ]);
    }

    /**
     * Link the authenticated account to a Facebook profile ID.
     */
    public function linkFacebook(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'access_token' => ['required', 'string', 'min:20'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $profile = $this->fetchFacebookProfile((string) $request->input('access_token'));
        } catch (\Throwable $e) {
            Log::warning('Facebook profile fetch failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Could not verify Facebook account.'], 422);
        }

        $facebookId = (string) ($profile['id'] ?? '');
        if ($facebookId === '') {
            return response()->json(['error' => 'Invalid Facebook account data.'], 422);
        }

        $takenByOther = User::where('facebook_id', $facebookId)->where('id', '!=', $user->id)->exists();
        if ($takenByOther) {
            return response()->json(['error' => 'That Facebook account is already linked to another user.'], 409);
        }

        $user->facebook_id = $facebookId;
        $user->save();

        return response()->json([
            'ok' => true,
            'facebook_id' => $facebookId,
            'facebook_name' => $profile['name'] ?? null,
        ]);
    }

    /**
     * Fetch Facebook friends (who also authorized this app) and match them with app users.
     */
    public function findFacebookFriends(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'access_token' => ['required', 'string', 'min:20'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $accessToken = (string) $request->input('access_token');
        $graphVersion = (string) config('services.facebook.graph_version', 'v20.0');

        try {
            $friendsRes = Http::timeout(12)->get("https://graph.facebook.com/{$graphVersion}/me/friends", [
                'access_token' => $accessToken,
                'fields' => 'id,name,picture',
                'limit' => 200,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Facebook friends request failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Could not contact Facebook right now.'], 502);
        }

        if (! $friendsRes->ok()) {
            Log::warning('Facebook friends request non-200', [
                'status' => $friendsRes->status(),
                'body' => $friendsRes->body(),
            ]);
            return response()->json(['error' => 'Facebook friend sync failed.'], 422);
        }

        $friends = $friendsRes->json('data');
        if (!is_array($friends)) {
            $friends = [];
        }

        $friendIds = collect($friends)
            ->map(fn ($f) => is_array($f) ? (string) ($f['id'] ?? '') : '')
            ->filter(fn ($id) => $id !== '')
            ->values();

        if ($friendIds->isEmpty()) {
            return response()->json([
                'ok' => true,
                'matched' => [],
                'facebook_friend_count' => 0,
                'matched_count' => 0,
                'message' => 'No Facebook friends returned. This is expected unless friends also authorized this app.',
            ]);
        }

        $friendMetaById = [];
        foreach ($friends as $friend) {
            if (!is_array($friend) || empty($friend['id'])) continue;
            $friendMetaById[(string) $friend['id']] = [
                'facebook_name' => $friend['name'] ?? null,
                'facebook_picture' => $friend['picture']['data']['url'] ?? null,
            ];
        }

        $matchedUsers = User::query()
            ->whereIn('facebook_id', $friendIds->all())
            ->where('id', '!=', $user->id)
            ->select(['id', 'handle', 'display_name', 'avatar_url', 'facebook_id'])
            ->limit(100)
            ->get()
            ->map(function (User $matched) use ($friendMetaById) {
                $meta = $friendMetaById[(string) $matched->facebook_id] ?? [];
                return [
                    'id' => (string) $matched->id,
                    'handle' => $matched->handle,
                    'display_name' => $matched->display_name,
                    'avatar_url' => $matched->avatar_url,
                    'facebook_id' => $matched->facebook_id,
                    'facebook_name' => $meta['facebook_name'] ?? null,
                    'facebook_picture' => $meta['facebook_picture'] ?? null,
                ];
            })
            ->values();

        return response()->json([
            'ok' => true,
            'matched' => $matchedUsers,
            'facebook_friend_count' => $friendIds->count(),
            'matched_count' => $matchedUsers->count(),
        ]);
    }

    /**
     * Match phone contacts against users with verified phone numbers.
     */
    public function matchContacts(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user instanceof User) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'phones' => ['required', 'array', 'min:1', 'max:500'],
            'phones.*' => ['required', 'string', 'max:32'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $normalized = collect((array) $request->input('phones', []))
            ->map(fn ($p) => $this->normalizePhone((string) $p))
            ->filter(fn ($p) => $p !== null)
            ->unique()
            ->values();

        if ($normalized->isEmpty()) {
            return response()->json([
                'ok' => true,
                'matched' => [],
                'submitted_count' => 0,
                'matched_count' => 0,
            ]);
        }

        $matchedUsers = User::query()
            ->whereIn('phone_number', $normalized->all())
            ->whereNotNull('phone_verified_at')
            ->where('id', '!=', $user->id)
            ->select(['id', 'handle', 'display_name', 'avatar_url', 'phone_number'])
            ->limit(200)
            ->get()
            ->map(fn (User $matched) => [
                'id' => (string) $matched->id,
                'handle' => $matched->handle,
                'display_name' => $matched->display_name,
                'avatar_url' => $matched->avatar_url,
                'phone_number' => $matched->phone_number,
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'matched' => $matchedUsers,
            'submitted_count' => $normalized->count(),
            'matched_count' => $matchedUsers->count(),
        ]);
    }

    private function fetchFacebookProfile(string $accessToken): array
    {
        $graphVersion = (string) config('services.facebook.graph_version', 'v20.0');
        $res = Http::timeout(10)->get("https://graph.facebook.com/{$graphVersion}/me", [
            'access_token' => $accessToken,
            'fields' => 'id,name,picture',
        ]);
        if (! $res->ok()) {
            throw new \RuntimeException('facebook_profile_request_failed');
        }
        $payload = $res->json();
        return is_array($payload) ? $payload : [];
    }

    private function normalizePhone(string $raw): ?string
    {
        $trimmed = trim($raw);
        if ($trimmed === '') return null;

        $digits = preg_replace('/\D+/', '', $trimmed);
        if (!is_string($digits) || strlen($digits) < 8 || strlen($digits) > 15) {
            return null;
        }

        return '+' . $digits;
    }

    /**
     * Logout user
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Successfully logged out']);
    }
}
