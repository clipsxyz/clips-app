<?php

namespace App\Jobs;

use App\Models\RenderJob;
use App\Models\Post;
use App\Models\Music;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class ProcessRenderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public string $jobId;
    public int $tries = 3; // Retry up to 3 times
    public int $timeout = 600; // 10 minutes timeout

    public function __construct(string $jobId)
    {
        $this->jobId = $jobId;
    }

    public function handle(): void
    {
        $job = RenderJob::findOrFail($this->jobId);
        $post = Post::findOrFail($job->post_id);

        try {
            Log::info("Processing render job {$this->jobId} for post {$post->id}");

            // Step 1: Handle music (AI-generated or library track)
            $musicUrl = null;
            
            // Check if post has a library music track selected
            if ($post->music_track_id) {
                $musicTrack = Music::find($post->music_track_id);
                if ($musicTrack) {
                    // Get music file path from library track
                    // For local storage, we need the full path, not just URL
                    if ($musicTrack->file_path) {
                        // Check if it's a storage path or full URL
                        if (str_starts_with($musicTrack->file_path, 'http')) {
                            $musicUrl = $musicTrack->file_path;
                        } else {
                            // Get full path for local storage
                            $musicUrl = Storage::disk('public')->path($musicTrack->file_path);
                            // If file doesn't exist, try URL instead
                            if (!file_exists($musicUrl)) {
                                $musicUrl = Storage::disk('public')->url($musicTrack->file_path);
                            }
                        }
                    } elseif ($musicTrack->url) {
                        $musicUrl = $musicTrack->url;
                    }
                    
                    // Store attribution in post if required
                    if ($musicTrack->license_requires_attribution && !$post->music_attribution) {
                        $post->music_attribution = $musicTrack->getAttributionText();
                        $post->save();
                    }
                    
                    // Increment usage count
                    $musicTrack->incrementUsage();
                    
                    // Set music URL on job for FFmpeg processing
                    $job->music_url = $musicUrl;
                    $job->save();
                    
                    Log::info("Using library music track: {$musicTrack->title} (ID: {$musicTrack->id})");
                }
            }
            
            // Generate AI music if requested (only if no library track selected)
            if (!$musicUrl && !empty($job->ai_music_config['enabled'])) {
                $job->status = 'generating_music';
                $job->save();

                Log::info("Generating AI music for job {$this->jobId}");
                $musicUrl = $this->generateAiMusic($job);
                
                if ($musicUrl) {
                    $job->music_url = $musicUrl;
                    $job->save();
                    Log::info("AI music generated: {$musicUrl}");
                } else {
                    Log::warning("AI music generation failed for job {$this->jobId}, continuing without music");
                }
            }

            // Step 2: Run FFmpeg render
            $job->status = 'rendering';
            $job->save();

            Log::info("Starting FFmpeg render for job {$this->jobId}");
            $finalUrl = $this->renderWithFfmpeg($job);

            if (!$finalUrl) {
                throw new \Exception('FFmpeg render failed - no output URL generated');
            }

            // Step 3: Update post and job as completed
            $post->final_video_url = $finalUrl;
            $post->save();

            $job->status = 'completed';
            $job->final_video_url = $finalUrl;
            $job->save();

            Log::info("Render job {$this->jobId} completed successfully. Final video: {$finalUrl}");
        } catch (\Throwable $e) {
            Log::error("Render job {$this->jobId} failed: " . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);

            $job->status = 'failed';
            $job->error_message = $e->getMessage();
            $job->save();

            // Optionally notify user of failure
            // You could dispatch a notification here
        }
    }

    protected function generateAiMusic(RenderJob $job): ?string
    {
        // TODO: Implement AI music generation
        // This would call an external AI music API (e.g., Suno, Mubert, etc.)
        // For now, return null to skip music generation
        
        $config = $job->ai_music_config;
        $duration = $config['durationSeconds'] ?? 30;
        $mood = $config['mood'] ?? 'happy';
        $genre = $config['genre'] ?? 'pop';
        
        Log::info("AI music generation requested", [
            'duration' => $duration,
            'mood' => $mood,
            'genre' => $genre
        ]);

        // Placeholder: In production, you would:
        // 1. Call AI music API with prompt
        // 2. Download the generated music file
        // 3. Store it in your storage (S3, local, etc.)
        // 4. Return the URL
        
        return null;
    }

    protected function renderWithFfmpeg(RenderJob $job): ?string
    {
        $editTimeline = $job->edit_timeline;
        $sourceUrl = $job->video_source_url;
        $musicUrl = $job->music_url;

        if (empty($editTimeline['clips']) || count($editTimeline['clips']) === 0) {
            throw new \Exception('Edit timeline has no clips');
        }

        $clips = $editTimeline['clips'];
        $maxDuration = 90; // Enforce 90 second max
        $transitions = $editTimeline['transitions'] ?? [];
        $overlays = $editTimeline['overlays'] ?? [];

        // Handle multiple clips
        if (count($clips) > 1) {
            return $this->renderMultipleClips($clips, $transitions, $maxDuration, $musicUrl, $overlays);
        }

        // Single clip handling (existing code)
        $clip = $clips[0];
        $trimStart = $clip['trimStart'] ?? 0;
        $trimEnd = $clip['trimEnd'] ?? null;
        $speed = $clip['speed'] ?? 1.0;
        $reverse = $clip['reverse'] ?? false;
        $filters = $clip['filters'] ?? null; // Get filter adjustments

        // Download source video to temporary location
        $clipUrl = $clip['mediaUrl'] ?? $sourceUrl;
        $tempInputPath = $this->downloadVideo($clipUrl);
        if (!$tempInputPath) {
            throw new \Exception('Failed to download source video');
        }

        $tempMusicPath = null;
        try {
            // Handle music if provided
            if ($musicUrl) {
                // Check if it's a local file path (for library tracks)
                if (file_exists($musicUrl)) {
                    // It's already a local file path, use it directly
                    $tempMusicPath = $musicUrl;
                    Log::info("Using local music file: {$musicUrl}");
                } else {
                    // It's a URL, download it
                    $tempMusicPath = $this->downloadVideo($musicUrl);
                    if (!$tempMusicPath) {
                        Log::warning("Failed to download music from URL: {$musicUrl}, continuing without music");
                    }
                }
            }

            // Build output path
            $outputFilename = 'rendered_' . Str::uuid() . '.mp4';
            $outputPath = storage_path('app/public/videos/' . $outputFilename);
            
            // Ensure directory exists
            $outputDir = dirname($outputPath);
            if (!is_dir($outputDir)) {
                mkdir($outputDir, 0755, true);
            }

            // Build FFmpeg command
            $ffmpegCmd = $this->buildFfmpegCommand(
                $tempInputPath,
                $outputPath,
                $trimStart,
                $trimEnd,
                $speed,
                $reverse,
                $maxDuration,
                $tempMusicPath,
                $filters,
                $overlays,
                null,
                null,
                $editTimeline
            );

            Log::info("Executing FFmpeg command", ['command' => $ffmpegCmd]);

            // Execute FFmpeg
            exec($ffmpegCmd . ' 2>&1', $output, $returnCode);

            if ($returnCode !== 0 || !file_exists($outputPath)) {
                $errorOutput = implode("\n", $output);
                Log::error("FFmpeg failed", [
                    'return_code' => $returnCode,
                    'output' => $errorOutput
                ]);
                throw new \Exception("FFmpeg render failed: {$errorOutput}");
            }

            // Get file size to verify it's not empty
            $fileSize = filesize($outputPath);
            if ($fileSize < 1000) { // Less than 1KB is suspicious
                throw new \Exception("FFmpeg output file is too small ({$fileSize} bytes)");
            }

            // Generate public URL (adjust based on your storage setup)
            $publicUrl = Storage::url('videos/' . $outputFilename);
            
            // If using S3 or other cloud storage, upload the file here
            // For now, assuming local storage with public access

            Log::info("FFmpeg render completed", [
                'output_path' => $outputPath,
                'file_size' => $fileSize,
                'public_url' => $publicUrl
            ]);

            return $publicUrl;
        } finally {
            // Clean up temporary files
            if (file_exists($tempInputPath)) {
                unlink($tempInputPath);
            }
            // Only delete temp music files (downloaded), not library files (local paths)
            if ($tempMusicPath && file_exists($tempMusicPath) && str_contains($tempMusicPath, 'temp/')) {
                unlink($tempMusicPath);
            }
        }
    }

    protected function downloadVideo(string $url): ?string
    {
        $tempPath = storage_path('app/temp/' . Str::uuid() . '.mp4');
        $tempDir = dirname($tempPath);
        
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Download file
        $fileContents = @file_get_contents($url);
        if ($fileContents === false) {
            Log::error("Failed to download video from {$url}");
            return null;
        }

        file_put_contents($tempPath, $fileContents);
        return $tempPath;
    }

    protected function buildFfmpegCommand(
        string $inputPath,
        string $outputPath,
        float $trimStart,
        ?float $trimEnd,
        float $speed,
        bool $reverse,
        int $maxDuration,
        ?string $tempMusicPath,
        ?array $filters = null,
        ?array $overlays = null,
        ?string $tempVoiceoverPath = null,
        ?string $tempBgPath = null,
        ?array $editTimeline = null
    ): string {
        // Base FFmpeg command
        $cmd = 'ffmpeg -y'; // -y to overwrite output file

        // Input video
        $cmd .= ' -i ' . escapeshellarg($inputPath);

        // Add music if provided
        if ($tempMusicPath && file_exists($tempMusicPath)) {
            $cmd .= ' -i ' . escapeshellarg($tempMusicPath);
        }

        // Build filter complex for trimming, speed, reverse
        $videoFilters = [];
        
        // Green screen chromakey filter (apply first, before other filters)
        if ($tempBgPath && file_exists($tempBgPath)) {
            // Use chromakey filter to remove green background
            // Color: green (0x00FF00), similarity: 0.3, blend: 0.1
            $videoFilters[] = "chromakey=color=0x00FF00:similarity=0.3:blend=0.1";
        }

        // Trim filter
        if ($trimStart > 0 || $trimEnd !== null) {
            $start = $trimStart;
            $duration = $trimEnd !== null ? ($trimEnd - $trimStart) : null;
            
            if ($duration !== null) {
                // Ensure duration doesn't exceed max
                $duration = min($duration, $maxDuration);
                $videoFilters[] = "trim=start={$start}:duration={$duration}";
            } else {
                $videoFilters[] = "trim=start={$start}";
            }
        }

        // Speed filter (using setpts)
        if ($speed != 1.0) {
            $pts = 1.0 / $speed;
            $videoFilters[] = "setpts={$pts}*PTS";
        }

        // Reverse filter
        if ($reverse) {
            $videoFilters[] = "reverse";
        }

        // Color adjustments (brightness, contrast, saturation)
        if ($filters && (isset($filters['brightness']) || isset($filters['contrast']) || isset($filters['saturation']))) {
            $eqParts = [];
            
            // Brightness (eq filter: brightness=brightness-1, so 1.0 = no change, 1.1 = +10%)
            if (isset($filters['brightness']) && $filters['brightness'] != 1.0) {
                $brightness = $filters['brightness'];
                $eqParts[] = "brightness=" . ($brightness - 1.0);
            }
            
            // Contrast
            if (isset($filters['contrast']) && $filters['contrast'] != 1.0) {
                $contrast = $filters['contrast'];
                $eqParts[] = "contrast={$contrast}";
            }
            
            // Saturation
            if (isset($filters['saturation']) && $filters['saturation'] != 1.0) {
                $saturation = $filters['saturation'];
                $eqParts[] = "saturation={$saturation}";
            }
            
            if (!empty($eqParts)) {
                // Use eq filter for color adjustments
                $eqString = implode(':', $eqParts);
                $videoFilters[] = "eq={$eqString}";
            }
        }

        // Add overlays (text and stickers)
        $overlayFilters = [];
        if ($overlays && !empty($overlays)) {
            foreach ($overlays as $overlay) {
                $startTime = $overlay['startTime'] ?? 0;
                $endTime = $overlay['endTime'] ?? $maxDuration;
                
                if ($overlay['type'] === 'sticker') {
                    // Text sticker
                    if (isset($overlay['textContent'])) {
                        $text = $overlay['textContent'];
                        $x = ($overlay['x'] ?? 50) / 100; // Convert percentage to decimal
                        $y = ($overlay['y'] ?? 50) / 100;
                        $fontSize = $overlay['fontSize'] === 'large' ? 48 : ($overlay['fontSize'] === 'medium' ? 32 : 24);
                        $color = $overlay['textColor'] ?? 'white';
                        $opacity = $overlay['opacity'] ?? 1.0;
                        
                        // Escape text for FFmpeg
                        $escapedText = str_replace(['\\', ':', "'"], ['\\\\', '\\:', "\\'"], $text);
                        
                        // Build drawtext filter with timing
                        $drawtext = "drawtext=text='{$escapedText}':";
                        $drawtext .= "fontsize={$fontSize}:";
                        $drawtext .= "fontcolor={$color}@{$opacity}:";
                        $drawtext .= "x=(w-text_w)*{$x}:";
                        $drawtext .= "y=(h-text_h)*{$y}:";
                        $drawtext .= "enable='between(t,{$startTime},{$endTime})'";
                        
                        $overlayFilters[] = $drawtext;
                    } elseif (isset($overlay['sticker']['url'])) {
                        // Image sticker - download and overlay
                        $stickerUrl = $overlay['sticker']['url'];
                        $tempStickerPath = $this->downloadVideo($stickerUrl); // Reuse downloadVideo for images
                        
                        if ($tempStickerPath && file_exists($tempStickerPath)) {
                            // Get video dimensions for positioning
                            $probeCmd = 'ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ' . escapeshellarg($inputPath);
                            exec($probeCmd, $probeOutput, $probeReturn);
                            $dimensions = $probeReturn === 0 && !empty($probeOutput) ? trim($probeOutput[0]) : '1920x1080';
                            [$videoWidth, $videoHeight] = explode('x', $dimensions);
                            
                            // Calculate position (x, y are percentages)
                            $xPercent = ($overlay['x'] ?? 50) / 100;
                            $yPercent = ($overlay['y'] ?? 50) / 100;
                            $scale = $overlay['scale'] ?? 1.0;
                            $rotation = $overlay['rotation'] ?? 0;
                            
                            // Build overlay filter
                            // First, scale and rotate the sticker image
                            $stickerFilter = "[{$audioInputIndex}:v]scale=iw*{$scale}:ih*{$scale}";
                            if ($rotation != 0) {
                                $stickerFilter .= ",rotate={$rotation}*PI/180";
                            }
                            $stickerFilter .= "[sticker{$overlay['id']}]";
                            
                            // Then overlay it on the video
                            $xPos = "({$videoWidth}*{$xPercent}-overlay_w/2)";
                            $yPos = "({$videoHeight}*{$yPercent}-overlay_h/2)";
                            
                            $overlayFilter = "[0:v][sticker{$overlay['id']}]overlay={$xPos}:{$yPos}:enable='between(t,{$startTime},{$endTime})'";
                            
                            // Add sticker as input
                            $cmd = str_replace(' -i ' . escapeshellarg($inputPath), 
                                ' -i ' . escapeshellarg($inputPath) . ' -i ' . escapeshellarg($tempStickerPath), 
                                $cmd);
                            
                            // Add sticker processing to filter complex
                            $overlayFilters[] = $stickerFilter;
                            $overlayFilters[] = $overlayFilter;
                            
                            // Track sticker paths for cleanup
                            if (!isset($this->tempStickerPaths)) {
                                $this->tempStickerPaths = [];
                            }
                            $this->tempStickerPaths[] = $tempStickerPath;
                        } else {
                            Log::warning("Failed to download sticker image", ['sticker_id' => $overlay['stickerId'], 'url' => $stickerUrl]);
                        }
                    }
                }
            }
        }

        // Combine all video filters
        $allFilters = array_merge($videoFilters, $overlayFilters);
        
        // Apply filters
        if (!empty($allFilters)) {
            $filterComplex = implode(',', $allFilters);
            $cmd .= " -vf {$filterComplex}";
        }

        // Audio handling with proper mixing
        if ($tempMusicPath && file_exists($tempMusicPath)) {
            // Get volume levels from edit timeline or use defaults
            $videoVolume = $editTimeline['videoVolume'] ?? 0.5; // Default: 50% video audio
            $musicVolume = $editTimeline['musicVolume'] ?? 1.0; // Default: 100% music
            
            // Use filter_complex to mix video audio and music with volume control
            // Format: [0:a]volume=0.5[a0]; [1:a]volume=1.2[a1]; [a0][a1]amix=inputs=2:duration=first:dropout_transition=2
            $audioFilter = sprintf(
                '[0:a]volume=%.2f[a0]; [1:a]volume=%.2f[a1]; [a0][a1]amix=inputs=2:duration=first:dropout_transition=2[audio]',
                $videoVolume,
                $musicVolume
            );
            
            // Add filter_complex if we don't already have one
            if (empty($allFilters)) {
                $cmd .= " -filter_complex \"{$audioFilter}\"";
            } else {
                // Combine video filters and audio filters
                $videoFilterStr = implode(',', $allFilters);
                $combinedFilter = "[0:v]{$videoFilterStr}[v]; {$audioFilter}";
                $cmd .= " -filter_complex \"{$combinedFilter}\"";
                $cmd .= ' -map "[v]"'; // Map video output
            }
            
            $cmd .= ' -map "[audio]"'; // Map mixed audio output
            $cmd .= ' -c:a aac -b:a 128k'; // Encode audio as AAC
        } else {
            // No music - keep original audio or adjust volume
            $videoVolume = $editTimeline['videoVolume'] ?? 1.0;
            
            if ($videoVolume != 1.0) {
                // Apply volume adjustment to video audio
                $audioFilter = sprintf('[0:a]volume=%.2f[audio]', $videoVolume);
                
                if (empty($allFilters)) {
                    $cmd .= " -filter_complex \"{$audioFilter}\"";
                    $cmd .= ' -map 0:v:0'; // Video
                    $cmd .= ' -map "[audio]"'; // Audio
                } else {
                    $videoFilterStr = implode(',', $allFilters);
                    $combinedFilter = "[0:v]{$videoFilterStr}[v]; {$audioFilter}";
                    $cmd .= " -filter_complex \"{$combinedFilter}\"";
                    $cmd .= ' -map "[v]"'; // Video
                    $cmd .= ' -map "[audio]"'; // Audio
                }
                $cmd .= ' -c:a aac -b:a 128k';
            } else {
                // No volume adjustment needed
                $cmd .= ' -map 0:v:0'; // Video
                if (empty($allFilters)) {
                    $cmd .= ' -c:a copy'; // Copy audio stream
                } else {
                    // We have video filters, need to map video separately
                    $videoFilterStr = implode(',', $allFilters);
                    $cmd .= " -vf {$videoFilterStr}";
                    $cmd .= ' -c:a copy';
                }
            }
        }

        // Video codec settings (H.264 for compatibility)
        $cmd .= ' -c:v libx264';
        $cmd .= ' -preset medium';
        $cmd .= ' -crf 23'; // Quality setting (lower = better quality, larger file)
        $cmd .= ' -movflags +faststart'; // Optimize for web streaming

        // Enforce max duration
        $cmd .= " -t {$maxDuration}";

        // Output
        $cmd .= ' ' . escapeshellarg($outputPath);

        return $cmd;
    }

    protected function renderMultipleClips(array $clips, array $transitions, int $maxDuration, ?string $musicUrl, array $overlays = [], ?string $voiceoverUrl = null): string
    {
        $tempPaths = [];
        $processedClips = [];
        
        try {
            // Download and process each clip
            foreach ($clips as $index => $clip) {
                $clipUrl = $clip['mediaUrl'];
                $tempInputPath = $this->downloadVideo($clipUrl);
                if (!$tempInputPath) {
                    Log::warning("Failed to download clip {$index}, skipping");
                    continue;
                }
                $tempPaths[] = $tempInputPath;

                // Process individual clip (trim, speed, reverse, filters)
                $processedPath = storage_path('app/temp/processed_' . Str::uuid() . '.mp4');
                $trimStart = $clip['trimStart'] ?? 0;
                $trimEnd = $clip['trimEnd'] ?? null;
                $speed = $clip['speed'] ?? 1.0;
                $reverse = $clip['reverse'] ?? false;
                $filters = $clip['filters'] ?? null;

                // Filter overlays for this clip's time range
                $clipOverlays = [];
                if (!empty($overlays)) {
                    $clipStartTime = $clip['startTime'] ?? 0;
                    $clipEndTime = $clipStartTime + ($clipDuration ?? 0);
                    
                    foreach ($overlays as $overlay) {
                        $overlayStart = $overlay['startTime'] ?? 0;
                        $overlayEnd = $overlay['endTime'] ?? $clipEndTime;
                        
                        // Check if overlay overlaps with this clip
                        if ($overlayStart < $clipEndTime && $overlayEnd > $clipStartTime) {
                            // Adjust overlay timing relative to clip start
                            $adjustedOverlay = $overlay;
                            $adjustedOverlay['startTime'] = max(0, $overlayStart - $clipStartTime);
                            $adjustedOverlay['endTime'] = min($clipDuration, $overlayEnd - $clipStartTime);
                            $clipOverlays[] = $adjustedOverlay;
                        }
                    }
                }
                
                $clipCmd = $this->buildFfmpegCommand(
                    $tempInputPath,
                    $processedPath,
                    $trimStart,
                    $trimEnd,
                    $speed,
                    $reverse,
                    $maxDuration,
                    null, // No music for individual clips
                    $filters,
                    $clipOverlays
                );

                // Remove music mapping from single clip command
                $clipCmd = preg_replace('/ -map \d+:[av]:\d+/', '', $clipCmd);
                $clipCmd = preg_replace('/ -c:a (copy|aac)/', ' -an', $clipCmd); // Remove audio for now

                Log::info("Processing clip {$index}", ['command' => $clipCmd]);
                exec($clipCmd . ' 2>&1', $output, $returnCode);

                if ($returnCode !== 0 || !file_exists($processedPath)) {
                    Log::error("Failed to process clip {$index}");
                    continue;
                }

                $processedClips[] = $processedPath;
            }

            if (empty($processedClips)) {
                throw new \Exception('No clips were successfully processed');
            }

            // Build final output path
            $outputFilename = 'rendered_' . Str::uuid() . '.mp4';
            $outputPath = storage_path('app/public/videos/' . $outputFilename);
            $outputDir = dirname($outputPath);
            if (!is_dir($outputDir)) {
                mkdir($outputDir, 0755, true);
            }

            // Check if we have transitions
            $hasTransitions = !empty($transitions) && count($transitions) > 0;
            
            if ($hasTransitions && count($processedClips) > 1) {
                // Use xfade filter for transitions
                $this->renderWithTransitions($processedClips, $transitions, $outputPath, $maxDuration, $musicUrl, $overlays);
            } else {
                // Simple concatenation without transitions
                $concatFile = storage_path('app/temp/concat_' . Str::uuid() . '.txt');
                $concatContent = '';
                foreach ($processedClips as $clipPath) {
                    $concatContent .= "file '" . str_replace("'", "'\\''", $clipPath) . "'\n";
                }
                file_put_contents($concatFile, $concatContent);

                $concatCmd = 'ffmpeg -y';
                $concatCmd .= ' -f concat -safe 0 -i ' . escapeshellarg($concatFile);
                
                // Add music if provided
                $tempMusicPath = null;
                if ($musicUrl) {
                    $tempMusicPath = $this->downloadVideo($musicUrl);
                    if ($tempMusicPath) {
                        $concatCmd .= ' -i ' . escapeshellarg($tempMusicPath);
                        $concatCmd .= ' -map 0:v:0 -map 1:a:0';
                        $concatCmd .= ' -c:a aac -b:a 128k';
                    } else {
                        $concatCmd .= ' -c:a copy';
                    }
                } else {
                    $concatCmd .= ' -c:a copy';
                }

                $concatCmd .= ' -c:v libx264 -preset medium -crf 23';
                $concatCmd .= ' -movflags +faststart';
                $concatCmd .= ' -t ' . $maxDuration;
                $concatCmd .= ' ' . escapeshellarg($outputPath);

                Log::info("Concatenating clips", ['command' => $concatCmd]);
                exec($concatCmd . ' 2>&1', $output, $returnCode);

                if ($returnCode !== 0 || !file_exists($outputPath)) {
                    $errorOutput = implode("\n", $output);
                    Log::error("FFmpeg concatenation failed", [
                        'return_code' => $returnCode,
                        'output' => $errorOutput
                    ]);
                    throw new \Exception("FFmpeg concatenation failed: {$errorOutput}");
                }

                @unlink($concatFile);
                if ($tempMusicPath) {
                    @unlink($tempMusicPath);
                }
            }

            // Clean up processed clips
            foreach ($processedClips as $clipPath) {
                @unlink($clipPath);
            }

            $publicUrl = Storage::url('videos/' . $outputFilename);
            Log::info("Multi-clip render completed", ['output_path' => $outputPath, 'public_url' => $publicUrl]);

            return $publicUrl;
        } finally {
            // Clean up temporary input files
            foreach ($tempPaths as $path) {
                if (file_exists($path)) {
                    @unlink($path);
                }
            }
        }
    }

    protected function renderWithTransitions(array $processedClips, array $transitions, string $outputPath, int $maxDuration, ?string $musicUrl): void
    {
        // Build input list
        $inputList = '';
        foreach ($processedClips as $clipPath) {
            $inputList .= ' -i ' . escapeshellarg($clipPath);
        }

        // Get clip durations
        $clipDurations = [];
        $totalDuration = 0;
        foreach ($processedClips as $clipPath) {
            $durationCmd = 'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' . escapeshellarg($clipPath);
            exec($durationCmd, $durationOutput, $durationReturn);
            $duration = $durationReturn === 0 && !empty($durationOutput) ? (float)trim($durationOutput[0]) : 5.0;
            $clipDurations[] = $duration;
            $totalDuration += $duration;
        }

        // Build xfade filter complex
        $filterParts = [];
        $currentOffset = 0;
        
        // Process first clip
        $filterParts[] = "[0:v]setpts=PTS-STARTPTS[v0]";
        
        // Add transitions between clips
        for ($i = 1; $i < count($processedClips); $i++) {
            $prevIndex = $i - 1;
            $transition = $transitions[$prevIndex] ?? ['type' => 'none', 'duration' => 0.5];
            
            // Calculate offset (end of previous clip minus transition duration)
            $prevDuration = $clipDurations[$prevIndex];
            $transitionDuration = ($transition['type'] !== 'none') ? ($transition['duration'] ?? 0.5) : 0;
            $offset = $currentOffset + $prevDuration - $transitionDuration;
            
            if ($transition['type'] !== 'none' && $transitionDuration > 0) {
                // Map transition type to FFmpeg xfade transition
                // Supported xfade transitions: fade, slideleft, slideright, slideup, slidedown, 
                // zoom, zoomin, zoomout, spin, fadewhite, fadeblack, wiperight, wipeleft, wipeup, wipedown
                $xfadeType = 'fade'; // Default
                
                $transitionType = $transition['type'] ?? 'fade';
                switch ($transitionType) {
                    case 'fade':
                    case 'crossfade':
                        $xfadeType = 'fade';
                        break;
                    case 'slideleft':
                        $xfadeType = 'slideleft';
                        break;
                    case 'slideright':
                        $xfadeType = 'slideright';
                        break;
                    case 'slideup':
                        $xfadeType = 'slideup';
                        break;
                    case 'slidedown':
                        $xfadeType = 'slidedown';
                        break;
                    case 'zoom':
                        $xfadeType = 'zoom';
                        break;
                    case 'zoomin':
                        $xfadeType = 'zoomin';
                        break;
                    case 'zoomout':
                        $xfadeType = 'zoomout';
                        break;
                    case 'spin':
                        $xfadeType = 'spin';
                        break;
                    case 'fadewhite':
                    case 'flash':
                        $xfadeType = 'fadewhite';
                        break;
                    case 'fadeblack':
                        $xfadeType = 'fadeblack';
                        break;
                    case 'wiperight':
                        $xfadeType = 'wiperight';
                        break;
                    case 'wipeleft':
                        $xfadeType = 'wipeleft';
                        break;
                    case 'wipeup':
                        $xfadeType = 'wipeup';
                        break;
                    case 'wipedown':
                        $xfadeType = 'wipedown';
                        break;
                    default:
                        $xfadeType = 'fade';
                        break;
                }
                
                // Set PTS for current clip
                $filterParts[] = "[{$i}:v]setpts=PTS-STARTPTS+{$offset}/TB[v{$i}raw]";
                // Apply xfade transition: xfade=transition={type}:duration={duration}:offset={offset}
                $filterParts[] = "[v{$prevIndex}][v{$i}raw]xfade=transition={$xfadeType}:duration={$transitionDuration}:offset={$offset}[v{$i}]";
            } else {
                // No transition - simple concatenation
                $filterParts[] = "[{$i}:v]setpts=PTS-STARTPTS+{$currentOffset}/TB[v{$i}raw]";
                $filterParts[] = "[v{$prevIndex}][v{$i}raw]overlay=0:0:enable='between(t,{$currentOffset},{$currentOffset}+{$clipDurations[$i]})'[v{$i}]";
            }
            
            $currentOffset += $prevDuration - $transitionDuration;
        }

        $filterComplex = implode(';', $filterParts);
        $lastOutput = 'v' . (count($processedClips) - 1);

        // Build FFmpeg command
        $cmd = 'ffmpeg -y';
        $cmd .= $inputList;
        
        // Add music if provided
        $tempMusicPath = null;
        $musicInputIndex = count($processedClips);
        if ($musicUrl) {
            $tempMusicPath = $this->downloadVideo($musicUrl);
            if ($tempMusicPath) {
                $cmd .= ' -i ' . escapeshellarg($tempMusicPath);
            }
        }

        $cmd .= " -filter_complex \"{$filterComplex}\"";
        $cmd .= " -map \"[{$lastOutput}]\"";
        
        if ($tempMusicPath) {
            $cmd .= " -map {$musicInputIndex}:a:0";
            $cmd .= ' -c:a aac -b:a 128k';
        } else {
            $cmd .= ' -c:a copy';
        }

        $cmd .= ' -c:v libx264 -preset medium -crf 23';
        $cmd .= ' -movflags +faststart';
        $cmd .= ' -t ' . min($totalDuration, $maxDuration);
        $cmd .= ' ' . escapeshellarg($outputPath);

        Log::info("Rendering with transitions", ['command' => $cmd]);
        exec($cmd . ' 2>&1', $output, $returnCode);

        if ($returnCode !== 0 || !file_exists($outputPath)) {
            $errorOutput = implode("\n", $output);
            Log::error("FFmpeg transition render failed", [
                'return_code' => $returnCode,
                'output' => $errorOutput
            ]);
            throw new \Exception("FFmpeg transition render failed: {$errorOutput}");
        }

        if ($tempMusicPath) {
            @unlink($tempMusicPath);
        }
    }
}

