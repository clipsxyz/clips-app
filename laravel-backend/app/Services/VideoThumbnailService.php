<?php

namespace App\Services;

use App\Models\Post;
use App\Support\DominantColor;
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
            // Run even on the early-return path: the poster may predate this feature, so the
            // colour is still missing on a post whose thumbnail is already present.
            $this->ensureDominantColorFor($post);

            return $existing;
        }

        if (!$this->isVideoPost($post)) {
            // Still-image posts never reach the FFmpeg branch, but they can still be
            // sampled straight off their own media, which is where most feed colour comes from.
            $this->ensureDominantColorFor($post);

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
            $this->ensureDominantColorFor($post);

            return $sibling;
        }

        $url = $this->extractJpeg($source, (string) $post->id);
        if ($url === null) {
            return null;
        }

        $post->thumbnail_url = $url;
        $this->mergePosterIntoMediaItems($post, $url);
        $post->save();
        $this->ensureDominantColorFor($post);

        return $url;
    }

    /**
     * Sample and persist a dominant colour for the feed's ambient canvas.
     *
     * IDEMPOTENT BY DESIGN. An existing value is never recomputed, so this is safe to call
     * on every render pass and never causes a write for a post that already has a colour.
     * Deliberately not folded into the thumbnail save: sampling can fail (missing file,
     * unreadable remote URL) and must never block or roll back thumbnail generation.
     */
    public function ensureDominantColorFor(Post $post): void
    {
        if ($this->hasDominantColor($post)) {
            return;
        }

        $hex = $this->sampleDominantColorFor($post);
        if ($hex === null) {
            return;
        }

        $post->dominant_color = $hex;
        $post->save();
    }

    /**
     * Compute the post's dominant colour WITHOUT persisting it.
     *
     * Split out from ensureDominantColorFor for one specific reason: the persist path saves
     * internally, so a `--dry-run` backfill that called it and then "undid" the value in
     * memory would still have written every row. Callers that must not write use this.
     */
    public function sampleDominantColorFor(Post $post): ?string
    {
        // Poster first: it is a small, cheap, already-generated JPEG and it is what the
        // feed actually displays for a video card.
        $hex = $this->sampleFromUrl(is_string($post->thumbnail_url) ? $post->thumbnail_url : null);
        if ($hex === null) {
            $hex = $this->sampleFromUrl($this->firstImageUrl($post));
        }

        return $hex;
    }

    private function hasDominantColor(Post $post): bool
    {
        return trim((string) ($post->dominant_color ?? '')) !== '';
    }

    /**
     * Sample a colour from a URL that may be a local path, a `/storage/...` URL, or remote.
     *
     * Remote sources are fetched rather than skipped because poster/media URLs can point at
     * a CDN. Bounded by a short timeout: a slow host must not stall the render job, and a
     * missing colour only costs the ambient tint.
     */
    private function sampleFromUrl(?string $url): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }

        $local = $this->resolveLocalPath($url);
        if ($local !== null) {
            return DominantColor::fromFile($local);
        }

        if (! preg_match('#^https?://#i', $url)) {
            return null;
        }

        $context = stream_context_create([
            'http' => ['timeout' => 4, 'follow_location' => 1, 'max_redirects' => 2],
        ]);
        $binary = @file_get_contents($url, false, $context);
        if ($binary === false || $binary === '') {
            return null;
        }

        return DominantColor::fromString($binary);
    }

    /** First still-image source on the post, used when there is no poster to sample. */
    private function firstImageUrl(Post $post): ?string
    {
        $items = is_array($post->media_items) ? $post->media_items : [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $url = $item['url'] ?? null;
            if (is_string($url) && $url !== '' && ($item['type'] ?? null) === 'image') {
                return $url;
            }
        }

        if (is_string($post->media_url)
            && $post->media_url !== ''
            && preg_match('/\.(jpe?g|png|webp|gif)(\?|$)/i', $post->media_url)) {
            return $post->media_url;
        }

        return null;
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
