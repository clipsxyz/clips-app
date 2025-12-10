<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Music;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MusicController extends Controller
{
    /**
     * Generate AI music (placeholder - will integrate with AI service)
     */
    public function generate(Request $request): JsonResponse
    {
        // Get request data - Laravel automatically parses JSON
        $requestData = $request->all();
        
        // Convert duration to integer if it's a float
        if (isset($requestData['duration']) && is_numeric($requestData['duration'])) {
            $requestData['duration'] = (int) round($requestData['duration']);
        }
        
        // Log raw request data for debugging
        Log::info('Music generation request received', [
            'request_data' => $requestData,
            'content_type' => $request->header('Content-Type'),
            'method' => $request->method(),
        ]);
        
        $validator = Validator::make($requestData, [
            'mood' => 'required|string|in:happy,energetic,calm,dramatic,romantic,upbeat',
            'genre' => 'required|string|in:pop,rock,electronic,hip-hop,jazz,classical',
            'duration' => 'nullable|numeric|min:5|max:90', // Allow numeric (int or float), will convert to int
        ]);

        if ($validator->fails()) {
            $errors = $validator->errors();
            Log::warning('Music generation validation failed', [
                'errors' => $errors->toArray(),
                'request_data' => $requestData,
            ]);
            return response()->json([
                'errors' => $errors->toArray(),
                'message' => 'Validation failed. Please check that mood and genre are selected correctly.',
                'received_data' => $requestData,
            ], 400);
        }

        $mood = $requestData['mood'];
        $genre = $requestData['genre'];
        $duration = isset($requestData['duration']) ? (int) round($requestData['duration']) : 30;

        // Log without requiring database connection
        try {
            Log::info('AI music generation requested', [
                'mood' => $mood,
                'genre' => $genre,
                'duration' => $duration,
                'user_id' => Auth::id() ?? 'guest'
            ]);
        } catch (\Exception $e) {
            // If logging fails (e.g., no database), continue anyway
        }

        try {
            // Increase execution time for music generation
            set_time_limit(180); // 3 minutes
            
            // Generate prompt from mood and genre
            $prompt = $this->buildMusicPrompt($mood, $genre);
            
            // Call self-hosted MusicGen service (open-source, runs locally)
            $audioData = $this->generateMusicWithLocalService($prompt, $duration);
            
            if (!$audioData) {
                throw new \Exception('Failed to generate music from local service');
            }
            
            // Save audio file
            $disk = config('filesystems.default', env('FILESYSTEM_DISK', 'public'));
            $directory = 'uploads/music/ai-generated';
            
            // Ensure directory exists
            if (!Storage::disk($disk)->exists($directory)) {
                Storage::disk($disk)->makeDirectory($directory);
            }
            
            $filename = $directory . '/' . time() . '-' . Str::random(8) . '.wav';
            Storage::disk($disk)->put($filename, $audioData);
            $fileUrl = Storage::disk($disk)->url($filename);
            
            // Create music record (if database is available)
            // AI-generated music is royalty-free (no attribution required)
            // MusicGen by Meta is open-source and generates original content
            try {
                $music = Music::create([
                    'title' => "AI Music - " . Str::title($mood) . " " . Str::title($genre),
                    'artist' => 'AI Composer',
                    'genre' => $genre,
                    'mood' => $mood,
                    'duration' => $duration,
                    'url' => $fileUrl,
                    'is_ai_generated' => true,
                    'is_active' => true,
                    // Mark as royalty-free - AI-generated music is original and requires no attribution
                    'license_type' => 'AI Generated (Royalty-Free)',
                    'license_url' => 'https://github.com/facebookresearch/audiocraft',
                    'license_requires_attribution' => false,
                ]);
                
                return response()->json([
                    'success' => true,
                    'data' => $music,
                    'message' => 'Music generated successfully!'
                ]);
            } catch (\Exception $e) {
                // If database save fails, still return the file URL
                return response()->json([
                    'success' => true,
                    'data' => [
                        'id' => null,
                        'title' => "AI Music - " . Str::title($mood) . " " . Str::title($genre),
                        'artist' => 'AI Composer',
                        'genre' => $genre,
                        'mood' => $mood,
                        'duration' => $duration,
                        'url' => $fileUrl,
                        'is_ai_generated' => true,
                        'license_type' => 'AI Generated (Royalty-Free)',
                        'license_url' => 'https://github.com/facebookresearch/audiocraft',
                        'license_requires_attribution' => false,
                    ],
                    'message' => 'Music generated successfully!'
                ]);
            }
            
        } catch (\Exception $e) {
            Log::error('Music generation failed', [
                'error' => $e->getMessage(),
                'mood' => $mood,
                'genre' => $genre
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate music: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get music library with filters
     */
    public function library(Request $request): JsonResponse
    {
        $query = Music::active();

        // Filter by genre
        if ($request->has('genre')) {
            $query->byGenre($request->input('genre'));
        }

        // Filter by mood
        if ($request->has('mood')) {
            $query->byMood($request->input('mood'));
        }

        // Filter by type (ai_generated or library)
        if ($request->has('type')) {
            if ($request->input('type') === 'ai') {
                $query->aiGenerated();
            } else {
                $query->library();
            }
        }

        // Search by title or artist
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('title', 'LIKE', "%{$search}%")
                  ->orWhere('artist', 'LIKE', "%{$search}%");
            });
        }

        // Sort by usage count (most popular first) or recently added
        $sortBy = $request->input('sort', 'usage_count'); // usage_count or created_at
        $sortOrder = $request->input('order', 'desc'); // asc or desc
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('per_page', 20);
        $music = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $music->items(),
            'pagination' => [
                'current_page' => $music->currentPage(),
                'last_page' => $music->lastPage(),
                'per_page' => $music->perPage(),
                'total' => $music->total(),
            ]
        ]);
    }

    /**
     * Get single music track
     */
    public function show(string $id): JsonResponse
    {
        $music = Music::active()->findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => $music
        ]);
    }

    /**
     * Upload custom audio file and add to music library
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240|mimes:mp3,wav,m4a,aac,ogg',
            'title' => 'nullable|string|max:255',
            'artist' => 'nullable|string|max:255',
            'genre' => 'nullable|string',
            'mood' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $file = $request->file('file');
        try {
            $user = Auth::user();
        } catch (\Exception $e) {
            // If auth fails (e.g., no database), continue without user
            $user = null;
        }

        // Generate unique filename
        $filename = 'music/' . $user->id . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
        
        $disk = config('filesystems.default', env('FILESYSTEM_DISK', 'public'));
        
        // Store file
        $path = $file->storeAs('uploads', $filename, $disk);
        $fileUrl = Storage::disk($disk)->url($path);

        // Get audio duration (basic estimation or use metadata)
        $duration = null; // TODO: Extract actual duration from audio file

        // Create music record
        $music = Music::create([
            'title' => $request->input('title', $file->getClientOriginalName()),
            'artist' => $request->input('artist', 'Unknown'),
            'genre' => $request->input('genre'),
            'mood' => $request->input('mood'),
            'duration' => $duration,
            'url' => $fileUrl,
            'is_ai_generated' => false,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'data' => $music,
            'fileUrl' => $fileUrl
        ]);
    }

    /**
     * Increment usage count when music is used in a post
     */
    public function incrementUsage(string $id): JsonResponse
    {
        $music = Music::findOrFail($id);
        $music->incrementUsage();

        return response()->json([
            'success' => true,
            'usage_count' => $music->usage_count
        ]);
    }

    /**
     * Build music prompt from mood and genre
     */
    private function buildMusicPrompt(string $mood, string $genre): string
    {
        $moodDescriptions = [
            'happy' => 'upbeat, cheerful, joyful',
            'energetic' => 'fast-paced, high-energy, dynamic',
            'calm' => 'peaceful, relaxing, soothing',
            'dramatic' => 'intense, emotional, powerful',
            'romantic' => 'soft, gentle, tender',
            'upbeat' => 'lively, positive, energetic'
        ];
        
        $genreDescriptions = [
            'pop' => 'pop music',
            'rock' => 'rock music',
            'electronic' => 'electronic music',
            'hip-hop' => 'hip-hop music',
            'jazz' => 'jazz music',
            'classical' => 'classical music'
        ];
        
        $moodDesc = $moodDescriptions[$mood] ?? $mood;
        $genreDesc = $genreDescriptions[$genre] ?? $genre;
        
        return "{$moodDesc} {$genreDesc}, instrumental, no vocals";
    }

    /**
     * Generate music using self-hosted MusicGen service (open-source, local)
     */
    private function generateMusicWithLocalService(string $prompt, int $duration): ?string
    {
        $serviceUrl = env('MUSICGEN_SERVICE_URL', 'http://localhost:5000');
        
        try {
            $sslVerify = filter_var(env('SSL_VERIFY', 'true'), FILTER_VALIDATE_BOOLEAN);
            
            $response = Http::timeout(120)
                ->withOptions(['verify' => $sslVerify])
                ->post("{$serviceUrl}/generate", [
                    'prompt' => $prompt,
                    'duration' => min($duration, 30),
                ]);
            
            if ($response->successful()) {
                return $response->body();
            }
            
            throw new \Exception('Local MusicGen service error: ' . $response->body());
            
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new \Exception('Cannot connect to MusicGen service. Make sure the service is running at ' . $serviceUrl . '. See musicgen-service/README.md for setup instructions.');
        } catch (\Exception $e) {
            Log::error('Local MusicGen service call failed', [
                'error' => $e->getMessage(),
                'prompt' => $prompt
            ]);
            throw $e;
        }
    }
    
    /**
     * Generate music using Replicate API (hosts open-source MusicGen models)
     * Replicate provides a reliable API for open-source models
     * @deprecated Use generateMusicWithLocalService instead
     */
    private function generateMusicWithHuggingFace(string $prompt, int $duration): ?string
    {
        // Use Replicate API - it hosts open-source MusicGen models with a reliable API
        $replicateToken = env('REPLICATE_API_TOKEN');
        
        if (!$replicateToken) {
            // Try Hugging Face as fallback if Replicate token not set
            return $this->tryHuggingFaceFallback($prompt, $duration);
        }
        
        try {
            $sslVerify = filter_var(env('SSL_VERIFY', 'true'), FILTER_VALIDATE_BOOLEAN);
            
            // Replicate API endpoint for MusicGen
            $apiUrl = 'https://api.replicate.com/v1/predictions';
            
            $headers = [
                'Authorization' => "Token {$replicateToken}",
                'Content-Type' => 'application/json',
            ];
            
            // Start prediction
            $response = Http::timeout(30)
                ->withOptions(['verify' => $sslVerify])
                ->withHeaders($headers)
                ->post($apiUrl, [
                    'version' => '671ac645ce5e552cc63a54c2d00cb78bcf9dd3a9', // MusicGen stable version
                    'input' => [
                        'prompt' => $prompt,
                        'duration' => min($duration, 30),
                        'model_version' => 'small',
                    ]
                ]);
            
            if (!$response->successful()) {
                throw new \Exception('Replicate API error: ' . $response->body());
            }
            
            $prediction = $response->json();
            $predictionId = $prediction['id'] ?? null;
            
            if (!$predictionId) {
                throw new \Exception('Failed to start prediction');
            }
            
            // Poll for result (max 2 minutes)
            $maxAttempts = 24; // 24 * 5 seconds = 2 minutes
            $attempt = 0;
            
            while ($attempt < $maxAttempts) {
                sleep(5);
                $attempt++;
                
                $statusResponse = Http::timeout(30)
                    ->withOptions(['verify' => $sslVerify])
                    ->withHeaders($headers)
                    ->get("https://api.replicate.com/v1/predictions/{$predictionId}");
                
                if (!$statusResponse->successful()) {
                    throw new \Exception('Failed to check prediction status');
                }
                
                $status = $statusResponse->json();
                
                if ($status['status'] === 'succeeded') {
                    // Download the audio file
                    $audioUrl = $status['output'] ?? null;
                    if (!$audioUrl) {
                        throw new \Exception('No audio output received');
                    }
                    
                    $audioResponse = Http::timeout(30)
                        ->withOptions(['verify' => $sslVerify])
                        ->get($audioUrl);
                    
                    if ($audioResponse->successful()) {
                        return $audioResponse->body();
                    }
                    throw new \Exception('Failed to download generated audio');
                } elseif ($status['status'] === 'failed') {
                    throw new \Exception('Music generation failed: ' . ($status['error'] ?? 'Unknown error'));
                }
                // Continue polling if status is 'starting' or 'processing'
            }
            
            throw new \Exception('Music generation timed out. Please try again.');
            
        } catch (\Exception $e) {
            Log::error('Replicate API call failed', [
                'error' => $e->getMessage(),
                'prompt' => $prompt
            ]);
            
            // Fallback to Hugging Face if Replicate fails
            return $this->tryHuggingFaceFallback($prompt, $duration);
        }
    }
    
    /**
     * Fallback to Hugging Face API
     */
    private function tryHuggingFaceFallback(string $prompt, int $duration): ?string
    {
        $apiToken = env('HUGGINGFACE_API_TOKEN');
        
        if (!$apiToken) {
            throw new \Exception('No API token configured. Please set either REPLICATE_API_TOKEN or HUGGINGFACE_API_TOKEN in your .env file. Get Replicate token from https://replicate.com/account/api-tokens (free tier available)');
        }
        
        // Original Hugging Face code as fallback
        $sslVerify = filter_var(env('SSL_VERIFY', 'true'), FILTER_VALIDATE_BOOLEAN);
        $model = 'facebook/musicgen-small';
        
        $headers = [
            'Content-Type' => 'application/json',
            'Authorization' => "Bearer {$apiToken}",
        ];
        
        $apiUrl = "https://router.huggingface.co/models/{$model}";
        
        $response = Http::timeout(90)
            ->withOptions(['verify' => $sslVerify, 'timeout' => 90])
            ->withHeaders($headers)
            ->post($apiUrl, [
                'inputs' => $prompt,
                'parameters' => ['duration' => min($duration, 30)]
            ]);
        
        if ($response->successful()) {
            $audioData = $response->body();
            if (!empty($audioData) && strlen($audioData) >= 100) {
                return $audioData;
            }
        }
        
        throw new \Exception('Both Replicate and Hugging Face APIs failed. Please check your API tokens or try the Upload/Library features.');
    }
}

