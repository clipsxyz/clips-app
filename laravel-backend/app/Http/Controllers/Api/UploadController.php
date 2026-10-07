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
    /** Laravel `max:` rule uses kilobytes — 262144 KB = 256 MB. */
    private const MAX_UPLOAD_KB = 262144;

    /** Absolute byte ceiling matching 256 MB. */
    private const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

    /**
     * Dev / ops: report live PHP upload limits for the HTTP process.
     */
    public function limits(): JsonResponse
    {
        $upload = (string) ini_get('upload_max_filesize');
        $post = (string) ini_get('post_max_size');
        $memory = (string) ini_get('memory_limit');

        return response()->json([
            'upload_max_filesize' => $upload,
            'post_max_size' => $post,
            'memory_limit' => $memory,
            'laravel_max_kb' => self::MAX_UPLOAD_KB,
            'ok' => $this->parseSize($upload ?: '0') >= self::MAX_UPLOAD_BYTES
                && $this->parseSize($post ?: '0') >= self::MAX_UPLOAD_BYTES,
        ]);
    }

    /**
     * Upload single file.
     * Note: PHP upload_max_filesize and post_max_size must be ≥ 256M
     * (use `composer serve` or php -d flags — see laravel-backend/php-dev.d/99-uploads.ini).
     */
    public function single(Request $request): JsonResponse
    {
        $this->increaseUploadLimits();

        $uploadMax = $this->parseSize(ini_get('upload_max_filesize') ?: '8M');
        $postMax = $this->parseSize(ini_get('post_max_size') ?: '8M');
        $maxAllowed = min($uploadMax, $postMax, self::MAX_UPLOAD_BYTES);

        $contentLength = $request->header('Content-Length') ? (int) $request->header('Content-Length') : 0;
        if ($contentLength > 0 && $contentLength > $maxAllowed) {
            return response()->json([
                'error' => 'File too large',
                'message' => "File size ({$this->formatBytes($contentLength)}) exceeds PHP limit ({$this->formatBytes($maxAllowed)}). Restart Laravel with: composer serve (upload_max_filesize/post_max_size=256M).",
                'maxSize' => $this->formatBytes($maxAllowed),
                'fileSize' => $this->formatBytes($contentLength),
                'phpUploadMax' => ini_get('upload_max_filesize'),
                'phpPostMax' => ini_get('post_max_size'),
                'instructions' => 'Run: composer serve  OR  php -d upload_max_filesize=256M -d post_max_size=256M -d memory_limit=512M artisan serve --host=0.0.0.0 --port=8000',
            ], 413);
        }

        if ($contentLength > self::MAX_UPLOAD_BYTES) {
            return response()->json([
                'error' => 'File too large',
                'message' => 'Maximum file size is 256MB.',
                'maxSize' => '256MB',
                'fileSize' => $this->formatBytes($contentLength),
            ], 413);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:' . self::MAX_UPLOAD_KB,
        ]);

        $allowedExtensions = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
        $file = $request->file('file');
        if ($file) {
            $extension = strtolower($file->getClientOriginalExtension());
            if (!in_array($extension, $allowedExtensions, true)) {
                return response()->json([
                    'error' => 'Invalid file type',
                    'message' => 'File type not allowed. Allowed types: ' . implode(', ', $allowedExtensions),
                    'received_extension' => $extension,
                ], 400);
            }
        }

        if ($validator->fails()) {
            $errors = $validator->errors();
            if ($errors->has('file')) {
                foreach ($errors->get('file') as $error) {
                    if (str_contains($error, 'max')) {
                        return response()->json([
                            'error' => 'File too large',
                            'message' => 'Maximum file size is 256MB.',
                            'maxSize' => '256MB',
                            'errors' => $errors,
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
            $disk = 'public';
        }
        if (!in_array($disk, ['public', 's3', 'local'], true)) {
            $disk = 'public';
        }

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
                $hint = 'Storage directory is not writable. Ensure storage/app/public (and uploads) can be written by the PHP process.';
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
            'mimetype' => $file->getMimeType(),
        ]);
    }

    /**
     * Upload multiple files
     */
    public function multiple(Request $request): JsonResponse
    {
        $this->increaseUploadLimits();

        $validator = Validator::make($request->all(), [
            'files.*' => 'required|file|max:' . self::MAX_UPLOAD_KB,
        ]);

        $allowedExtensions = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
        $files = $request->file('files');
        if ($files) {
            foreach ($files as $file) {
                $extension = strtolower($file->getClientOriginalExtension());
                if (!in_array($extension, $allowedExtensions, true)) {
                    return response()->json([
                        'error' => 'Invalid file type',
                        'message' => 'File type not allowed. Allowed types: ' . implode(', ', $allowedExtensions),
                        'received_extension' => $extension,
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

        $disk = 'public';
        try {
            Storage::disk('public');
        } catch (\Exception $e) {
            $disk = config('filesystems.default', 'public');
        }

        $userId = $user ? $user->id : 'guest';
        foreach ($files as $file) {
            $filename = $userId . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('uploads', $filename, $disk);

            try {
                $fileUrl = Storage::disk($disk)->url($path);
                if (!str_starts_with($fileUrl, 'http')) {
                    $fileUrl = url($fileUrl);
                }
            } catch (\Exception $e) {
                $fileUrl = url('/storage/' . $path);
            }

            $uploadedFiles[] = [
                'fileUrl' => $fileUrl,
                'filename' => $filename,
                'originalName' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mimetype' => $file->getMimeType(),
            ];
        }

        return response()->json([
            'success' => true,
            'files' => $uploadedFiles,
        ]);
    }

    /**
     * Best-effort runtime bumps (upload_max_filesize / post_max_size usually require CLI -d / php.ini).
     */
    private function increaseUploadLimits(): void
    {
        @ini_set('upload_max_filesize', '256M');
        @ini_set('post_max_size', '256M');
        @ini_set('memory_limit', '512M');
        @ini_set('max_execution_time', '300');
        @ini_set('max_input_time', '300');
    }

    private function parseSize(string $size): int
    {
        $size = trim($size);
        if ($size === '') {
            return 8 * 1024 * 1024;
        }
        $last = strtolower($size[strlen($size) - 1]);
        $value = (int) $size;

        switch ($last) {
            case 'g':
                $value *= 1024;
                // no break
            case 'm':
                $value *= 1024;
                // no break
            case 'k':
                $value *= 1024;
        }

        return $value;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 2) . ' GB';
        }
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        }

        return $bytes . ' bytes';
    }
}
