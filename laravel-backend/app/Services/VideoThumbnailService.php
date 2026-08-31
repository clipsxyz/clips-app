<?php

namespace App\Services;

use App\Models\Post;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class VideoThumbnailService
{
    /**
     * Persist a JPEG poster on the post when one is missing.
     * Uses an existing poster URL when present; otherwise extracts a frame with FFmpeg.
     */
    public function ensureForPost(Post $post): ?string
    {
        $existing = $post->resolvedThumbnailUrl();
        if (is_string($existing) && $existing !== '') {
            if ($post->thumbnail_url !== $existing) {
                $post->thumbnail_url = $existing;
                $this->mergePosterIntoMediaItems($post, $existing);
                $post->save();
            }
            return $existing;
        }

        if (!$this->isVideoPost($post)) {
            return null;
        }

        $source = $this->videoSourceUrl($post);
        if ($source === null) {
            return null;
        }

        $sibling = $this->siblingJpegUrl($source);
        if ($sibling !== null) {
            $post->thumbnail_url = $sibling;
            $this->mergePosterIntoMediaItems($post, $sibling);
            $post->save();
            return $sibling;
        }

        $url = $this->extractJpeg($source, (string) $post->id);
        if ($url === null) {
            return null;
        }

        $post->thumbnail_url = $url;
        $this->mergePosterIntoMediaItems($post, $url);
        $post->save();

        return $url;
    }

    public function extractJpeg(string $videoUrl, string $postId): ?string
    {
        $input = $this->resolveLocalPath($videoUrl);
        if ($input === null) {
            return null;
        }

        $ffmpeg = $this->ffmpegBinary();
        if ($ffmpeg === null) {
            return null;
        }

        $relative = 'thumbnails/' . $postId . '.jpg';
        Storage::disk('public')->makeDirectory('thumbnails');
        $output = Storage::disk('public')->path($relative);

        $cmd = sprintf(
            '%s -y -ss 0.1 -i %s -frames:v 1 -q:v 2 %s 2>&1',
            escapeshellarg($ffmpeg),
            escapeshellarg($input),
            escapeshellarg($output)
        );
        $outputLines = [];
        $code = 0;
        exec($cmd, $outputLines, $code);

        if ($code !== 0 || !is_file($output) || filesize($output) < 32) {
            Log::warning('Video thumbnail extraction failed', [
                'post_id' => $postId,
                'return_code' => $code,
                'output' => implode("\n", array_slice($outputLines, 0, 20)),
            ]);
            return null;
        }

        return Storage::disk('public')->url($relative);
    }

    private function isVideoPost(Post $post): bool
    {
        if ($post->media_type === 'video') {
            return true;
        }
        $items = is_array($post->media_items) ? $post->media_items : [];
        foreach ($items as $item) {
            if (is_array($item) && ($item['type'] ?? null) === 'video') {
                return true;
            }
        }
        return is_string($post->media_url) && preg_match('/\.(mp4|mov|m4v|webm)(\?|$)/i', $post->media_url);
    }

    private function videoSourceUrl(Post $post): ?string
    {
        foreach ([$post->final_video_url, $post->media_url] as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
        }
        $items = is_array($post->media_items) ? $post->media_items : [];
        $first = is_array($items[0] ?? null) ? $items[0] : null;
        $url = is_array($first) ? ($first['url'] ?? null) : null;
        return is_string($url) && $url !== '' ? $url : null;
    }

    private function mergePosterIntoMediaItems(Post $post, string $posterUrl): void
    {
        $items = is_array($post->media_items) ? $post->media_items : [];
        if ($items === []) {
            if (is_string($post->media_url) && $post->media_url !== '') {
                $items = [[
                    'url' => $post->media_url,
                    'type' => $post->media_type ?: 'video',
                    'posterUrl' => $posterUrl,
                    'poster_url' => $posterUrl,
                    'thumbnail_url' => $posterUrl,
                    'thumbnailUrl' => $posterUrl,
                ]];
            }
        } else {
            foreach ($items as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }
                $type = $item['type'] ?? null;
                if ($type === 'video' || ($index === 0 && $type !== 'image')) {
                    $items[$index]['posterUrl'] = $item['posterUrl'] ?? $posterUrl;
                    $items[$index]['poster_url'] = $item['poster_url'] ?? $posterUrl;
                    $items[$index]['thumbnail_url'] = $item['thumbnail_url'] ?? $posterUrl;
                    $items[$index]['thumbnailUrl'] = $item['thumbnailUrl'] ?? $posterUrl;
                    break;
                }
            }
        }
        $post->media_items = $items;
    }

    private function resolveLocalPath(string $url): ?string
    {
        if (is_file($url)) {
            return $url;
        }
        $path = parse_url($url, PHP_URL_PATH);
        if (!is_string($path) || $path === '') {
            return null;
        }
        if (str_starts_with($path, '/storage/')) {
            $relative = ltrim(substr($path, strlen('/storage/')), '/');
            $full = Storage::disk('public')->path($relative);
            return is_file($full) ? $full : null;
        }
        return null;
    }

    private function siblingJpegUrl(string $videoUrl): ?string
    {
        $input = $this->resolveLocalPath($videoUrl);
        if ($input === null) {
            return null;
        }
        $dir = dirname($input);
        $base = pathinfo($input, PATHINFO_FILENAME);
        $exact = $dir . DIRECTORY_SEPARATOR . $base . '.jpg';
        $candidates = [];
        if (is_file($exact)) {
            $candidates[] = $exact;
        }
        $prefix = explode('-', $base)[0];
        if ($prefix !== '') {
            foreach (glob($dir . DIRECTORY_SEPARATOR . $prefix . '-*.jpg') ?: [] as $match) {
                if (is_file($match)) {
                    $candidates[] = $match;
                }
            }
        }
        if ($candidates === []) {
            $videoMtime = @filemtime($input) ?: 0;
            $closest = null;
            $closestDelta = 15;
            foreach (glob($dir . DIRECTORY_SEPARATOR . '*.jpg') ?: [] as $jpg) {
                if (!is_file($jpg)) {
                    continue;
                }
                $delta = abs((@filemtime($jpg) ?: 0) - $videoMtime);
                if ($delta <= $closestDelta) {
                    $closestDelta = $delta;
                    $closest = $jpg;
                }
            }
            if (is_string($closest)) {
                $candidates[] = $closest;
            }
        }
        if ($candidates === []) {
            return null;
        }
        $full = $candidates[0];
        $root = Storage::disk('public')->path('');
        $root = rtrim(str_replace('\\', '/', $root), '/');
        $normalized = str_replace('\\', '/', $full);
        if (!str_starts_with($normalized, $root . '/') && $normalized !== $root) {
            return null;
        }
        $relative = ltrim(substr($normalized, strlen($root)), '/');
        return Storage::disk('public')->url($relative);
    }

    private function ffmpegBinary(): ?string
    {
        foreach (['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'] as $bin) {
            if ($bin === 'ffmpeg') {
                $found = trim((string) shell_exec('command -v ffmpeg 2>/dev/null'));
                if ($found !== '') {
                    return $found;
                }
                continue;
            }
            if (is_file($bin) && is_executable($bin)) {
                return $bin;
            }
        }
        return null;
    }
}
