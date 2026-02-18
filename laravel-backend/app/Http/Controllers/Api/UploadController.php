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
        
        // Check current PHP limits (guard against empty ini values)
        $uploadMax = $this->parseSize(ini_get('upload_max_filesize') ?: '8M');
        $postMax = $this->parseSize(ini_get('post_max_size') ?: '8M');
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
        $user = null;
        try {
            $user = Auth::user();
        } catch (\Throwable $e) {
            // Auth may throw if guard not configured; continue as guest
        }

        $ext = $file->getClientOriginalExtension() ?: 'jpg';
        $userId = $user ? $user->id : 'guest';
        $filename = $userId . '/' . time() . '-' . uniqid() . '.' . $ext;

        $disk = config('filesystems.default');
        if ($disk === 'local') {
            $disk = 'public'; // prefer public so file is web-accessible
        }
        if (!in_array($disk, ['public', 's3', 'local'], true)) {
            $disk = 'public';
        }

        // Ensure uploads directory exists (avoids "No such file or directory" on some setups)
        try {
            Storage::disk($disk)->makeDirectory('uploads');
        } catch (\Throwable $e) {
            // ignore if already exists or not needed
        }

        try {
            $path = $file->storeAs('uploads', $filename, $disk);
        } catch (\Throwable $e) {
            \Log::error('Upload storeAs failed: ' . $e->getMessage(), ['disk' => $disk, 'exception' => $e]);
            $hint = 'Check storage permissions and that php artisan storage:link has been run.';
            $detail = $e->getMessage();
            if (str_contains(strtolower($detail), 'permission') || str_contains(strtolower($detail), 'denied')) {
                $hint = 'Storage directory is not writable. On this PC, ensure the folder storage/app/public (and storage/app/public/uploads) can be written by the user running PHP.';
            } elseif (str_contains(strtolower($detail), 'no such file') || str_contains(strtolower($detail), 'failed to open')) {
                $hint = 'Storage path missing or invalid. Run: php artisan storage:link';
            }
            return response()->json([
                'error' => 'Upload failed',
                'message' => $hint,
                'detail' => $detail,
            ], 500);
        }

        try {
            $fileUrl = Storage::disk($disk)->url($path);
            if (!str_starts_with($fileUrl, 'http')) {
                $fileUrl = url($fileUrl);
            }
        } catch (\Throwable $e) {
            $fileUrl = url('/storage/uploads/' . $filename);
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

        // Use a web-accessible filesystem disk (prefer 'public' for local dev so files are served via /storage)
        // Try 'public' first, then fall back to configured default
        $disk = 'public';
        try {
            Storage::disk('public');
        } catch (\Exception $e) {
            // Fallback to configured default disk (e.g. s3 or local)
            $disk = config('filesystems.default', 'public');
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
        if ($size === '') {
            return 8 * 1024 * 1024; // 8M default
        }
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
