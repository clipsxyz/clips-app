<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Music;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class MusicLibraryController extends Controller
{
    /**
     * Get all available music library tracks
     * Only returns license-safe tracks (CC0, CC-BY, CC-BY-SA, Public Domain)
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'genre' => 'nullable|string',
            'mood' => 'nullable|string',
            'search' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $query = Music::active()
            ->library() // Only library tracks (not AI-generated)
            ->licenseSafe(); // Only license-safe tracks

        // Filter by genre
        if ($request->has('genre') && $request->genre) {
            $query->byGenre($request->genre);
        }

        // Filter by mood
        if ($request->has('mood') && $request->mood) {
            $query->byMood($request->mood);
        }

        // Search by title or artist
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'LIKE', "%{$search}%")
                  ->orWhere('artist', 'LIKE', "%{$search}%");
            });
        }

        $tracks = $query->orderBy('usage_count', 'desc')
            ->orderBy('title', 'asc')
            ->get()
            ->map(function ($track) {
                // Get preview URL (use file_path if available, otherwise url)
                $previewUrl = null;
                if ($track->file_path) {
                    // Try to generate URL from file_path, fallback to url field
                    try {
                        // Check if file exists in storage
                        if (Storage::disk('public')->exists($track->file_path)) {
                            $url = Storage::disk('public')->url($track->file_path);
                            // Make sure it's an absolute URL
                            $previewUrl = str_starts_with($url, 'http') ? $url : url($url);
                        } elseif (Storage::disk('local')->exists($track->file_path)) {
                            // For local disk, use the serve endpoint
                            $previewUrl = url('/api/music/file/' . $track->id);
                        } else {
                            // File doesn't exist in storage, but still provide API endpoint for preview
                            // The endpoint will return 404, but at least the URL is valid
                            $previewUrl = url('/api/music/file/' . $track->id);
                        }
                    } catch (\Exception $e) {
                        // If storage fails, still provide API endpoint
                        $previewUrl = url('/api/music/file/' . $track->id);
                    }
                } elseif ($track->url) {
                    // If url is provided, check if it's absolute or relative
                    if (str_starts_with($track->url, 'http')) {
                        $previewUrl = $track->url;
                    } else {
                        // Relative URL - use API endpoint
                        $previewUrl = url('/api/music/file/' . $track->id);
                    }
                } else {
                    // No file_path or url - use API endpoint as fallback
                    $previewUrl = url('/api/music/file/' . $track->id);
                }

                return [
                    'id' => $track->id,
                    'title' => $track->title,
                    'artist' => $track->artist ?? 'Unknown',
                    'genre' => $track->genre,
                    'mood' => $track->mood,
                    'duration' => $track->duration,
                    'preview_url' => $previewUrl,
                    'url' => $previewUrl, // Also include as 'url' for compatibility
                    'license_type' => $track->license_type,
                    'license_url' => $track->license_url,
                    'license_requires_attribution' => $track->license_requires_attribution,
                    'attribution_text' => $track->getAttributionText(),
                    'thumbnail_url' => $track->thumbnail_url,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $tracks,
            'count' => $tracks->count(),
        ]);
    }

    /**
     * Get a single music track by ID
     */
    public function show($id): JsonResponse
    {
        $track = Music::active()
            ->library()
            ->licenseSafe()
            ->findOrFail($id);

        $previewUrl = null;
        if ($track->file_path) {
            // Try to generate URL from file_path, fallback to url field
            try {
                // Check if file exists in storage
                if (Storage::disk('public')->exists($track->file_path)) {
                    $url = Storage::disk('public')->url($track->file_path);
                    // Make sure it's an absolute URL
                    $previewUrl = str_starts_with($url, 'http') ? $url : url($url);
                } elseif (Storage::disk('local')->exists($track->file_path)) {
                    // For local disk, use the serve endpoint
                    $previewUrl = url('/api/music/file/' . $track->id);
                } else {
                    // File doesn't exist in storage, but still provide API endpoint for preview
                    $previewUrl = url('/api/music/file/' . $track->id);
                }
            } catch (\Exception $e) {
                // If storage fails, still provide API endpoint
                $previewUrl = url('/api/music/file/' . $track->id);
            }
        } elseif ($track->url) {
            // If url is provided, check if it's absolute or relative
            if (str_starts_with($track->url, 'http')) {
                $previewUrl = $track->url;
            } else {
                // Relative URL - use API endpoint
                $previewUrl = url('/api/music/file/' . $track->id);
            }
        } else {
            // No file_path or url - use API endpoint as fallback
            $previewUrl = url('/api/music/file/' . $track->id);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $track->id,
                'title' => $track->title,
                'artist' => $track->artist ?? 'Unknown',
                'genre' => $track->genre,
                'mood' => $track->mood,
                'duration' => $track->duration,
                'preview_url' => $previewUrl,
                'url' => $previewUrl, // Also include as 'url' for compatibility
                'license_type' => $track->license_type,
                'license_url' => $track->license_url,
                'license_requires_attribution' => $track->license_requires_attribution,
                'attribution_text' => $track->getAttributionText(),
                'thumbnail_url' => $track->thumbnail_url,
            ],
        ]);
    }

    /**
     * Serve music file for preview
     */
    public function serveFile($id)
    {
        try {
            $track = Music::active()
                ->library()
                ->licenseSafe()
                ->findOrFail($id);

        // Try to get file from storage
        $filePath = null;
        $disk = null;
        
        if ($track->file_path) {
            // Try public disk first
            try {
                $publicDisk = Storage::disk('public');
                if ($publicDisk->exists($track->file_path)) {
                    $filePath = $publicDisk->path($track->file_path);
                    $disk = 'public';
                }
            } catch (\Exception $e) {
                \Log::debug("Public disk check failed for {$track->file_path}: " . $e->getMessage());
            }
            
            // Try local disk if public didn't work
            if (!$filePath) {
                try {
                    $localDisk = Storage::disk('local');
                    if ($localDisk->exists($track->file_path)) {
                        $filePath = $localDisk->path($track->file_path);
                        $disk = 'local';
                    }
                } catch (\Exception $e) {
                    \Log::debug("Local disk check failed for {$track->file_path}: " . $e->getMessage());
                }
            }
            
            // Also try direct file path check
            if (!$filePath) {
                $directPath = storage_path('app/public/' . $track->file_path);
                if (file_exists($directPath)) {
                    $filePath = $directPath;
                    $disk = 'direct';
                }
            }
        }

            // If we have a file path and it exists, serve it
            if ($filePath && file_exists($filePath)) {
                // Determine MIME type from file extension
                $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                $mimeTypes = [
                    'mp3' => 'audio/mpeg',
                    'wav' => 'audio/wav',
                    'm4a' => 'audio/mp4',
                    'ogg' => 'audio/ogg',
                ];
                $contentType = $mimeTypes[$extension] ?? 'audio/mpeg';

                return response()->file($filePath, [
                    'Content-Type' => $contentType,
                    'Accept-Ranges' => 'bytes',
                    'Cache-Control' => 'public, max-age=3600',
                ]);
            }

            // If file doesn't exist, check if URL is provided and try to redirect
            if ($track->url && str_starts_with($track->url, 'http')) {
                // External URL - redirect to it
                return redirect($track->url);
            }

            // File doesn't exist - return 404 with helpful message
            \Log::warning("Music file not found for track {$track->id}", [
                'file_path' => $track->file_path,
                'url' => $track->url,
                'title' => $track->title,
            ]);

            return response()->json([
                'error' => 'Music file not found',
                'message' => 'The audio file for this track is not available. The music will still be added when you post.',
                'track_id' => $track->id,
                'file_path' => $track->file_path,
            ], 404);
        } catch (\Exception $e) {
            \Log::error("Error serving music file {$id}: " . $e->getMessage());
            return response()->json([
                'error' => 'Error loading music file',
                'message' => 'Could not load the music file. The music will still be added when you post.',
            ], 500);
        }
    }
}

