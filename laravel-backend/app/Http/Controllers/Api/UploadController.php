<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    /**
     * Upload single file
     * Note: PHP upload_max_filesize and post_max_size must be large enough (e.g., 100M+)
     */
    public function single(Request $request): JsonResponse
    {
        // Try to increase PHP limits
        $this->increaseUploadLimits();
        
        // Check current PHP limits
        $uploadMax = $this->parseSize(ini_get('upload_max_filesize'));
        $postMax = $this->parseSize(ini_get('post_max_size'));
        $maxAllowed = min($uploadMax, $postMax);
        
        // Check if request is too large (before validation)
        $contentLength = $request->header('Content-Length') ? (int)$request->header('Content-Length') : 0;
        if ($contentLength > 0 && $contentLength > $maxAllowed) {
            return response()->json([
                'error' => 'File too large',
                'message' => "File size ({$this->formatBytes($contentLength)}) exceeds PHP limit ({$this->formatBytes($maxAllowed)}). Please increase upload_max_filesize and post_max_size in php.ini to at least 100M.",
                'maxSize' => $this->formatBytes($maxAllowed),
                'fileSize' => $this->formatBytes($contentLength),
                'phpUploadMax' => ini_get('upload_max_filesize'),
                'phpPostMax' => ini_get('post_max_size'),
                'instructions' => 'Edit php.ini and set: upload_max_filesize = 100M and post_max_size = 100M, then restart PHP server.'
            ], 413);
        }
        
        if ($contentLength > 100 * 1024 * 1024) {
            return response()->json([
                'error' => 'File too large',
                'message' => 'Maximum file size is 100MB. Please reduce video quality or duration.',
                'maxSize' => '100MB',
                'fileSize' => $this->formatBytes($contentLength)
            ], 413);
        }

        // Validate file - use extensions instead of MIME types if fileinfo is not working
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:102400'
        ]);

        // Additional validation for file extensions (fallback if MIME validation fails)
        $allowedExtensions = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'webm', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
        $file = $request->file('file');
        if ($file) {
            $extension = strtolower($file->getClientOriginalExtension());
            if (!in_array($extension, $allowedExtensions)) {
                return response()->json([
                    'error' => 'Invalid file type',
                    'message' => 'File type not allowed. Allowed types: ' . implode(', ', $allowedExtensions),
                    'received_extension' => $extension
                ], 400);
            }
        }

        if ($validator->fails()) {
            $errors = $validator->errors();
            // Provide more helpful error messages
            if ($errors->has('file')) {
                $fileErrors = $errors->get('file');
                foreach ($fileErrors as $error) {
                    if (str_contains($error, 'max')) {
                        return response()->json([
                            'error' => 'File too large',
                            'message' => 'Maximum file size is 100MB. Please reduce video quality or duration.',
                            'maxSize' => '100MB',
                            'errors' => $errors
                        ], 413);
                    }
                }
            }
            return response()->json(['errors' => $errors], 400);
        }

        $file = $request->file('file');
        $user = Auth::user();

        // Generate unique filename with user ID for organization (or 'guest' if not authenticated)
        $userId = $user ? $user->id : 'guest';
        $filename = $userId . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
        
        // Use configured filesystem disk (local or s3)
        // Try 'local' first, then 'public', then default
        $disk = 'local';
        try {
            // Check if 'local' disk is available
            Storage::disk('local');
        } catch (\Exception $e) {
            // Try 'public' disk
            try {
                Storage::disk('public');
                $disk = 'public';
            } catch (\Exception $e2) {
                // Use default
                $disk = config('filesystems.default', 'local');
            }
        }
        
        // Store file
        $path = $file->storeAs('uploads', $filename, $disk);

        // Get full URL (works for both local and S3)
        try {
            $fileUrl = Storage::disk($disk)->url($path);
            // Make sure it's an absolute URL
            if (!str_starts_with($fileUrl, 'http')) {
                $fileUrl = url($fileUrl);
            }
        } catch (\Exception $e) {
            // If URL generation fails, create a route-based URL
            $fileUrl = url('/storage/' . $path);
        }

        return response()->json([
            'success' => true,
            'fileUrl' => $fileUrl,
            'filename' => $filename,
            'originalName' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mimetype' => $file->getMimeType()
        ]);
    }

    /**
     * Upload multiple files
     */
    public function multiple(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'files.*' => 'required|file|max:102400'
        ]);

        // Additional validation for file extensions (fallback if MIME validation fails)
        $allowedExtensions = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'webm', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
        $files = $request->file('files');
        if ($files) {
            foreach ($files as $file) {
                $extension = strtolower($file->getClientOriginalExtension());
                if (!in_array($extension, $allowedExtensions)) {
                    return response()->json([
                        'error' => 'Invalid file type',
                        'message' => 'File type not allowed. Allowed types: ' . implode(', ', $allowedExtensions),
                        'received_extension' => $extension
                    ], 400);
                }
            }
        }

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $files = $request->file('files');
        $user = Auth::user();
        $uploadedFiles = [];

        // Use configured filesystem disk (local or s3)
        // Try 'local' first, then 'public', then default
        $disk = 'local';
        try {
            // Check if 'local' disk is available
            Storage::disk('local');
        } catch (\Exception $e) {
            // Try 'public' disk
            try {
                Storage::disk('public');
                $disk = 'public';
            } catch (\Exception $e2) {
                // Use default
                $disk = config('filesystems.default', 'local');
            }
        }

        $userId = $user ? $user->id : 'guest';
        foreach ($files as $file) {
            // Generate unique filename with user ID for organization (or 'guest' if not authenticated)
            $filename = $userId . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            
            // Store file
            $path = $file->storeAs('uploads', $filename, $disk);
            
            // Get full URL (works for both local and S3)
            try {
                $fileUrl = Storage::disk($disk)->url($path);
                // Make sure it's an absolute URL
                if (!str_starts_with($fileUrl, 'http')) {
                    $fileUrl = url($fileUrl);
                }
            } catch (\Exception $e) {
                // If URL generation fails, create a route-based URL
                $fileUrl = url('/storage/' . $path);
            }

            $uploadedFiles[] = [
                'fileUrl' => $fileUrl,
                'filename' => $filename,
                'originalName' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mimetype' => $file->getMimeType()
            ];
        }

        return response()->json([
            'success' => true,
            'files' => $uploadedFiles
        ]);
    }
    
    /**
     * Increase PHP upload limits for this request
     */
    private function increaseUploadLimits(): void
    {
        // Try to increase limits if possible (won't work if ini_set is disabled)
        @ini_set('upload_max_filesize', '100M');
        @ini_set('post_max_size', '100M');
        @ini_set('max_execution_time', '300'); // 5 minutes for large uploads
        @ini_set('max_input_time', '300');
    }
    
    /**
     * Parse size string (e.g., "8M", "100M") to bytes
     */
    private function parseSize(string $size): int
    {
        $size = trim($size);
        $last = strtolower($size[strlen($size) - 1]);
        $value = (int)$size;
        
        switch ($last) {
            case 'g':
                $value *= 1024;
            case 'm':
                $value *= 1024;
            case 'k':
                $value *= 1024;
        }
        
        return $value;
    }
    
    /**
     * Format bytes to human-readable string
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 2) . ' GB';
        } elseif ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        } else {
            return $bytes . ' bytes';
        }
    }
}
