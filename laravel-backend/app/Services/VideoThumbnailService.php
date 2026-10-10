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
        // Repair per-slide posters first: a carousel tile renders its OWN item.posterUrl,
        // not the post-level poster, so a black frame on slide 2 must be fixed even when
        // slide 1's poster is perfectly fine.
        $this->ensureItemPosters($post);

        $existing = $post->resolvedThumbnailUrl();
        $existingIsBlack = $this->isLikelyBlackImage($existing);

        if (is_string($existing) && $existing !== '' && ! $existingIsBlack) {
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

            return $existing;
        }

        $source = $this->videoSourceUrl($post);
        if ($source === null) {
            return $existing;
        }

        // Only trust the sibling JPEG when it is a real picture — an uploaded "poster" is
        // often frame 0 of the clip, which is pure black on clips that open on a leader.
        $sibling = $this->siblingJpegUrl($source);
        if ($sibling !== null && ! $this->isLikelyBlackImage($sibling)) {
            $post->thumbnail_url = $sibling;
            $this->mergePosterIntoMediaItems($post, $sibling);
            $post->save();
            $this->ensureDominantColorFor($post);

            return $sibling;
        }

        $url = $this->extractJpeg($source, (string) $post->id);
        if ($url === null) {
            // Nothing better available — keep the old poster rather than dropping it.
            return $existing;
        }

        $post->thumbnail_url = $url;
        $this->mergePosterIntoMediaItems($post, $url);
        $post->save();
        $this->ensureDominantColorFor($post);

        return $url;
    }

    /**
     * True when a video post has a slide (or post-level) poster that is missing or a black
     * frame, i.e. the backfill has work to do. Read-only — never writes.
     */
    public function posterNeedsRepair(Post $post): bool
    {
        if (! $this->isVideoPost($post)) {
            return false;
        }

        $items = is_array($post->media_items) ? $post->media_items : [];
        foreach ($items as $item) {
            if (! is_array($item) || ($item['type'] ?? null) !== 'video') {
                continue;
            }
            $url = $item['url'] ?? null;
            if (! is_string($url) || $url === '') {
                continue;
            }
            $poster = $item['posterUrl']
                ?? $item['poster_url']
                ?? $item['thumbnail_url']
                ?? $item['thumbnailUrl']
                ?? null;
            if (! is_string($poster) || $poster === '' || $this->isLikelyBlackImage($poster)) {
                return true;
            }
        }

        if ($items === []) {
            $existing = $post->resolvedThumbnailUrl();
            if (! is_string($existing) || $existing === '' || $this->isLikelyBlackImage($existing)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Repair the poster on each video slide of a carousel.
     *
     * A slide with a missing or black poster is re-extracted from that slide's own MP4 so
     * its tile shows a real frame instead of a black square. Idempotent: slides that already
     * have a visible poster are left untouched, so this is safe to call on every render pass.
     */
    private function ensureItemPosters(Post $post): void
    {
        $items = is_array($post->media_items) ? $post->media_items : [];
        if ($items === [] || ! $this->isVideoPost($post)) {
            return;
        }

        $changed = false;
        foreach ($items as $index => $item) {
            if (! is_array($item) || ($item['type'] ?? null) !== 'video') {
                continue;
            }
            $url = $item['url'] ?? null;
            if (! is_string($url) || $url === '') {
                continue;
            }

            $poster = $item['posterUrl']
                ?? $item['poster_url']
                ?? $item['thumbnail_url']
                ?? $item['thumbnailUrl']
                ?? null;
            if (is_string($poster) && $poster !== '' && ! $this->isLikelyBlackImage($poster)) {
                continue;
            }

            $extracted = $this->extractJpeg($url, (string) $post->id, (int) $index);
            if ($extracted === null) {
                continue;
            }

            $items[$index]['posterUrl'] = $extracted;
            $items[$index]['poster_url'] = $extracted;
            $items[$index]['thumbnail_url'] = $extracted;
            $items[$index]['thumbnailUrl'] = $extracted;
            $changed = true;
        }

        if ($changed) {
            $post->media_items = $items;
            $post->save();
        }
    }

    /**
     * True when an encoded image is (near) uniformly black — the signature of a poster
     * captured from a clip's black leader frame.
     *
     * Requires a very low mean AND max luminance, so a mostly-dark-but-visible frame (night
     * scenes, a black title card with white text) is never mistaken for a blank one.
     */
    private function isLikelyBlackImage(?string $url): bool
    {
        if (! is_string($url) || $url === '') {
            return false;
        }

        $local = $this->resolveLocalPath($url);
        if ($local !== null) {
            return $this->isLikelyBlackFile($local);
        }

        if (! preg_match('#^https?://#i', $url)) {
            return false;
        }

        $context = stream_context_create([
            'http' => ['timeout' => 4, 'follow_location' => 1, 'max_redirects' => 2],
        ]);
        $binary = @file_get_contents($url, false, $context);
        if ($binary === false || $binary === '') {
            return false;
        }

        return $this->isLikelyBlackBinary($binary);
    }

    private function isLikelyBlackFile(string $path): bool
    {
        if (! is_file($path)) {
            return false;
        }

        $binary = @file_get_contents($path);
        if ($binary === false || $binary === '') {
            return false;
        }

        return $this->isLikelyBlackBinary($binary);
    }

    private function isLikelyBlackBinary(string $binary): bool
    {
        if (! function_exists('imagecreatefromstring')) {
            // No GD: we cannot inspect pixels, so never claim a poster is black.
            return false;
        }

        $image = @imagecreatefromstring($binary);
        if ($image === false) {
            return false;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 1 || $height < 1) {
            imagedestroy($image);

            return false;
        }

        $samples = 0;
        $sum = 0;
        $max = 0;
        $steps = 8;
        for ($i = 0; $i < $steps; $i++) {
            for ($j = 0; $j < $steps; $j++) {
                $x = (int) round($i * ($width - 1) / ($steps - 1));
                $y = (int) round($j * ($height - 1) / ($steps - 1));
                $rgb = imagecolorat($image, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                $luma = (int) round(0.299 * $r + 0.587 * $g + 0.114 * $b);
                $sum += $luma;
                $max = max($max, $luma);
                $samples++;
            }
        }
        imagedestroy($image);

        if ($samples === 0) {
            return false;
        }

        $mean = $sum / $samples;

        return $mean < 12.0 && $max < 30;
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

    public function extractJpeg(string $videoUrl, string $postId, ?int $itemIndex = null): ?string
    {
        $input = $this->resolveLocalPath($videoUrl);
        if ($input === null) {
            return null;
        }

        $ffmpeg = $this->ffmpegBinary();
        if ($ffmpeg === null) {
            return null;
        }

        $suffix = $itemIndex !== null ? '-' . $itemIndex : '';
        $relative = 'thumbnails/' . $postId . $suffix . '.jpg';
        Storage::disk('public')->makeDirectory('thumbnails');
        $output = Storage::disk('public')->path($relative);

        // Sample a few timestamps: a clip may open on a black leader, so frame 0 can be
        // uniformly black even though the video has plenty of visible content later.
        foreach ([0.1, 0.5, 1.0, 2.0, 3.0] as $offset) {
            $cmd = sprintf(
                '%s -y -ss %s -i %s -frames:v 1 -q:v 2 %s 2>&1',
                escapeshellarg($ffmpeg),
                escapeshellarg((string) $offset),
                escapeshellarg($input),
                escapeshellarg($output)
            );
            $outputLines = [];
            $code = 0;
            exec($cmd, $outputLines, $code);

            if ($code !== 0 || !is_file($output) || filesize($output) < 32) {
                Log::warning('Video thumbnail extraction failed', [
                    'post_id' => $postId,
                    'offset' => $offset,
                    'return_code' => $code,
                    'output' => implode("\n", array_slice($outputLines, 0, 20)),
                ]);
                continue;
            }

            if (! $this->isLikelyBlackFile($output)) {
                return Storage::disk('public')->url($relative);
            }
        }

        // Every sampled frame was black. Returning null lets the client paint its gradient
        // video-icon fallback instead of a blank black tile.
        Log::warning('Video thumbnail extraction produced only black frames', [
            'post_id' => $postId,
        ]);

        return null;
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
