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
     * Logout user
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Successfully logged out']);
    }
}
