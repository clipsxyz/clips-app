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
     */
    public function single(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240|mimes:jpeg,png,gif,mp4,webm'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $file = $request->file('file');
        $user = Auth::user();

        // Generate unique filename with user ID for organization
        $filename = $user->id . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
        
        // Use configured filesystem disk (local or s3)
        // Reads from FILESYSTEM_DISK env variable, defaults to 'public' for local storage
        $disk = config('filesystems.default', env('FILESYSTEM_DISK', 'public'));
        
        // Store file
        $path = $file->storeAs('uploads', $filename, $disk);

        // Get full URL (works for both local and S3)
        $fileUrl = Storage::disk($disk)->url($path);

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
            'files.*' => 'required|file|max:10240|mimes:jpeg,png,gif,mp4,webm'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $files = $request->file('files');
        $user = Auth::user();
        $uploadedFiles = [];

        // Use configured filesystem disk (local or s3)
        // Reads from FILESYSTEM_DISK env variable, defaults to 'public' for local storage
        $disk = config('filesystems.default', env('FILESYSTEM_DISK', 'public'));

        foreach ($files as $file) {
            // Generate unique filename with user ID for organization
            $filename = $user->id . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            
            // Store file
            $path = $file->storeAs('uploads', $filename, $disk);
            
            // Get full URL (works for both local and S3)
            $fileUrl = Storage::disk($disk)->url($path);

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
}
