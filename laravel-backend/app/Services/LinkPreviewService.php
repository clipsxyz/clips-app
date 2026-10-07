<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LinkPreviewService
{
    private const CACHE_TTL_SECONDS = 21600;
    private const MAX_HTML_BYTES = 512000;
    private const UA = 'Mozilla/5.0 (compatible; ClipsBot/1.0; +https://clips.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    /**
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}|null
     */
    public function previewFromText(?string $text): ?array
    {
        $url = $this->extractFirstUrl((string) $text);
        if ($url === null) {
            return null;
        }

        return $this->fetch($url);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}|null
     */
    public function normalizeClientPayload(array $payload): ?array
    {
        $url = $this->normalizeUrl((string) ($payload['url'] ?? ''));
        if ($url === null || ! $this->isPublicHttpUrl($url)) {
            return null;
        }

        $title = $this->cleanText($payload['title'] ?? null, 200);
        $description = $this->cleanText($payload['description'] ?? null, 300);
        $image = $this->normalizeUrl((string) ($payload['image_url'] ?? $payload['imageUrl'] ?? ''));
        $siteName = $this->cleanText($payload['site_name'] ?? $payload['siteName'] ?? null, 80);
        $video = $this->playableMediaUrl((string) ($payload['video_url'] ?? $payload['videoUrl'] ?? ''), $url);
        $isDirectVideo = $this->isDirectVideoUrl($url)
            || ($video !== null)
            || filter_var($payload['is_direct_video'] ?? $payload['isDirectVideo'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return $this->finalizePreview([
            'url' => $url,
            'title' => $title,
            'description' => $description,
            'image_url' => $image && $this->isPublicHttpUrl($image) ? $image : null,
            'site_name' => $siteName,
            'source' => $this->sourceLabel($url, $siteName),
            'video_url' => $video ?? ($this->isDirectVideoUrl($url) ? $url : null),
            'is_direct_video' => $isDirectVideo,
        ]);
    }

    /**
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}|null
     */
    public function fetch(string $url): ?array
    {
        $url = $this->normalizeUrl($url);
        if ($url === null || ! $this->isPublicHttpUrl($url)) {
            return null;
        }

        if ($this->isDirectVideoUrl($url)) {
            return $this->directVideoPreview($url);
        }

        $cacheKey = 'link_preview:v4:'.sha1($url);
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && ! empty($cached['url'])) {
            return $this->withInstagramFallback($url, $this->finalizePreview($cached));
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($this->isInstagramHost($host)) {
            $preview = $this->withInstagramFallback($url, $this->fetchInstagramOEmbed($url));
            Cache::put($cacheKey, $preview, self::CACHE_TTL_SECONDS);

            return $preview;
        }

        $preview = $this->fetchOEmbed($url);
        if ($preview === null) {
            $preview = $this->fetchOpenGraph($url);
        } elseif (empty($preview['video_url']) && str_contains($host, 'tiktok.com')) {
            $og = $this->fetchOpenGraph($url);
            if (is_array($og)) {
                if (! empty($og['video_url'])) {
                    $preview['video_url'] = $og['video_url'];
                }
                if (empty($preview['image_url']) && ! empty($og['image_url'])) {
                    $preview['image_url'] = $og['image_url'];
                }
            }
        }

        $preview = $this->withInstagramFallback($url, $preview);
        if ($preview === null) {
            $preview = [
                'url' => $url,
                'title' => null,
                'description' => null,
                'image_url' => null,
                'site_name' => null,
                'source' => $this->sourceLabel($url, null),
                'video_url' => null,
                'is_direct_video' => false,
            ];
        }

        $preview = $this->finalizePreview($preview);

        Cache::put($cacheKey, $preview, self::CACHE_TTL_SECONDS);

        return $preview;
    }

    /**
     * @param  array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}  $preview
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, thumbnail_url: ?string, site_name: ?string, source: string, is_direct_video: bool}
     */
    public function toClientPayload(array $preview): array
    {
        $preview['thumbnail_url'] = $preview['image_url'] ?? null;
        $preview['video_url'] = $preview['video_url'] ?? null;

        return $preview;
    }

    /**
     * @param  array<string, mixed>  $preview
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, video_url: ?string, is_direct_video: bool}
     */
    private function finalizePreview(array $preview): array
    {
        $pageUrl = (string) ($preview['url'] ?? '');
        $video = $preview['video_url'] ?? null;
        if (! is_string($video) || $video === '' || ! $this->isDirectVideoUrl($video) || ! $this->isPublicHttpUrl($video)) {
            $video = $this->isDirectVideoUrl($pageUrl) ? $pageUrl : null;
        }
        $preview['video_url'] = $video;
        $preview['is_direct_video'] = $video !== null;

        return $preview;
    }

    public function extractFirstUrl(string $text): ?string
    {
        if (! preg_match('#https?://[^\s<>"\']+#i', $text, $match)) {
            return null;
        }

        return $this->normalizeUrl(rtrim($match[0], '.,);]!?'));
    }

    private function fetchOEmbed(string $url): ?array
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $endpoint = null;
        if (str_contains($host, 'youtube.com') || $host === 'youtu.be' || str_ends_with($host, '.youtube.com')) {
            $endpoint = 'https://www.youtube.com/oembed?format=json&url='.rawurlencode($url);
        } elseif (str_contains($host, 'tiktok.com')) {
            $endpoint = 'https://www.tiktok.com/oembed?url='.rawurlencode($url);
        } elseif ($this->isInstagramHost($host)) {
            return $this->fetchInstagramOEmbed($url);
        }

        if ($endpoint === null) {
            return null;
        }

        try {
            $response = Http::timeout(8)
                ->withHeaders(['User-Agent' => self::UA, 'Accept' => 'application/json'])
                ->get($endpoint);
            if (! $response->successful()) {
                return null;
            }
            $json = $response->json();
            if (! is_array($json)) {
                return null;
            }
            $title = $this->cleanText($json['title'] ?? null, 200);
            $siteName = $this->cleanText($json['provider_name'] ?? null, 80);
            $image = $this->normalizeUrl((string) ($json['thumbnail_url'] ?? ''));
            $video = $this->playableMediaUrl((string) ($json['video_url'] ?? ''), $url);

            return [
                'url' => $url,
                'title' => $title,
                'description' => $this->cleanText($json['author_name'] ?? null, 300),
                'image_url' => $image && $this->isPublicHttpUrl($image) ? $image : null,
                'site_name' => $siteName,
                'source' => $this->sourceLabel($url, $siteName),
                'video_url' => $video,
                'is_direct_video' => $video !== null,
            ];
        } catch (\Throwable $e) {
            Log::info('link_preview.oembed_failed', ['url' => $url, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Instagram oEmbed via Graph API (app token) when Facebook credentials are configured.
     *
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}|null
     */
    private function fetchInstagramOEmbed(string $url): ?array
    {
        $appId = (string) config('services.facebook.app_id');
        $secret = (string) config('services.facebook.app_secret');
        $version = (string) (config('services.facebook.graph_version') ?: 'v20.0');
        if ($appId === '' || $secret === '') {
            return null;
        }

        $endpoint = 'https://graph.facebook.com/'.$version.'/instagram_oembed?url='.rawurlencode($url)
            .'&access_token='.rawurlencode($appId.'|'.$secret);

        try {
            $response = Http::timeout(8)
                ->withHeaders(['Accept' => 'application/json'])
                ->get($endpoint);
            if (! $response->successful()) {
                return null;
            }
            $json = $response->json();
            if (! is_array($json)) {
                return null;
            }
            $title = $this->cleanText($json['title'] ?? $json['author_name'] ?? null, 200);
            $image = $this->normalizeUrl((string) ($json['thumbnail_url'] ?? ''));
            if ($title === null && ($image === null || ! $this->isPublicHttpUrl($image))) {
                return null;
            }

            return [
                'url' => $url,
                'title' => $title,
                'description' => $this->cleanText($json['author_name'] ?? null, 300),
                'image_url' => $image && $this->isPublicHttpUrl($image) ? $image : null,
                'site_name' => 'Instagram',
                'source' => 'Instagram',
                'video_url' => null,
                'is_direct_video' => false,
            ];
        } catch (\Throwable $e) {
            Log::info('link_preview.instagram_oembed_failed', ['url' => $url, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @param  array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video?: bool}|null  $preview
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}|null
     */
    private function withInstagramFallback(string $url, ?array $preview): ?array
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if (! $this->isInstagramHost($host)) {
            return $preview;
        }

        $sparse = $preview === null
            || (empty($preview['title']) && empty($preview['image_url']) && empty($preview['description']));
        if (! $sparse && is_array($preview)) {
            $preview['is_direct_video'] = (bool) ($preview['is_direct_video'] ?? false);

            return $preview;
        }

        return [
            'url' => $url,
            'title' => $this->cleanText(is_array($preview) ? ($preview['title'] ?? null) : null, 200) ?? $this->instagramSharePrompt($url),
            'description' => $this->cleanText(is_array($preview) ? ($preview['description'] ?? null) : null, 300) ?? 'View on Instagram',
            'image_url' => null,
            'site_name' => 'Instagram',
            'source' => 'Instagram',
            'video_url' => null,
            'is_direct_video' => false,
        ];
    }

    /**
     * @return array{url: string, title: ?string, description: ?string, image_url: ?string, site_name: ?string, source: string, is_direct_video: bool}
     */
    private function directVideoPreview(string $url): array
    {
        return [
            'url' => $url,
            'title' => 'Video',
            'description' => null,
            'image_url' => null,
            'site_name' => null,
            'source' => $this->sourceLabel($url, null),
            'video_url' => $url,
            'is_direct_video' => true,
        ];
    }

    public function isDirectVideoUrl(string $url): bool
    {
        $noHash = explode('#', $url, 2)[0];
        if (preg_match('/\.(mp4|m4v|webm|mov|m3u8)(?:$|[\/?#])/i', $noHash) === 1) {
            return true;
        }

        return preg_match('/[?&](?:format|type|ext|mime)=(?:mp4|m3u8|m4v|webm|video(?:\/mp4)?)(?:&|$)/i', $noHash) === 1;
    }

    private function playableMediaUrl(string $candidate, string $base): ?string
    {
        $resolved = $this->absolutizeUrl($candidate, $base);
        if ($resolved === null || ! $this->isPublicHttpUrl($resolved) || ! $this->isDirectVideoUrl($resolved)) {
            return null;
        }

        return $resolved;
    }

    private function instagramSharePrompt(string $url): string
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));
        if (str_contains($path, '/stories/')) {
            return 'Check out my Instagram story';
        }
        if (preg_match('#/(reel|reels|tv)(/|$)#', $path) === 1) {
            return 'Check out my Instagram reel';
        }
        if (preg_match('#/(p|share)(/|$)#', $path) === 1) {
            return 'Check out my Instagram post';
        }

        return 'Check out my Instagram';
    }

    private function isInstagramHost(string $host): bool
    {
        $host = preg_replace('/^www\./', '', strtolower($host)) ?: $host;

        return $host === 'instagram.com'
            || str_ends_with($host, '.instagram.com')
            || $host === 'instagr.am';
    }

    private function fetchOpenGraph(string $url): ?array
    {
        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => self::UA,
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->withOptions(['allow_redirects' => ['max' => 3]])
                ->get($url);
            if (! $response->successful()) {
                return null;
            }
            $html = substr((string) $response->body(), 0, self::MAX_HTML_BYTES);
            if ($html === '') {
                return null;
            }

            $finalUrl = $this->normalizeUrl((string) $response->effectiveUri()) ?: $url;
            $og = $this->parseMeta($html);
            $title = $this->cleanText($og['og:title'] ?? $og['twitter:title'] ?? $this->parseHtmlTitle($html), 200);
            $description = $this->cleanText($og['og:description'] ?? $og['twitter:description'] ?? $og['description'] ?? null, 300);
            $siteName = $this->cleanText($og['og:site_name'] ?? null, 80);
            $image = $this->absolutizeUrl((string) ($og['og:image'] ?? $og['twitter:image'] ?? ''), $finalUrl);
            $video = $this->playableMediaUrl(
                (string) ($og['og:video:secure_url'] ?? $og['og:video:url'] ?? $og['og:video'] ?? $og['twitter:player:stream'] ?? ''),
                $finalUrl
            );

            if ($title === null && $image === null && $video === null) {
                return null;
            }

            return [
                'url' => $url,
                'title' => $title,
                'description' => $description,
                'image_url' => $image && $this->isPublicHttpUrl($image) ? $image : null,
                'site_name' => $siteName,
                'source' => $this->sourceLabel($url, $siteName),
                'video_url' => $video,
                'is_direct_video' => $video !== null,
            ];
        } catch (\Throwable $e) {
            Log::info('link_preview.og_failed', ['url' => $url, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @return array<string, string>
     */
    private function parseMeta(string $html): array
    {
        $out = [];
        if (preg_match_all('/<meta\b[^>]*>/i', $html, $tags) < 1) {
            return $out;
        }
        foreach ($tags[0] as $tag) {
            $property = null;
            $content = null;
            if (preg_match('/(?:property|name)\s*=\s*["\']([^"\']+)["\']/i', $tag, $m)) {
                $property = strtolower(trim($m[1]));
            }
            if (preg_match('/content\s*=\s*["\']([^"\']*)["\']/i', $tag, $m)) {
                $content = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
            if ($property && $content !== null && $content !== '') {
                $out[$property] = $content;
            }
        }

        return $out;
    }

    private function parseHtmlTitle(string $html): ?string
    {
        if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
            return html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return null;
    }

    private function sourceLabel(string $url, ?string $siteName): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host) ?: $host;
        if (str_contains($host, 'youtube.com') || $host === 'youtu.be') {
            return 'YouTube';
        }
        if (str_contains($host, 'tiktok.com')) {
            return 'TikTok';
        }
        if (str_contains($host, 'instagram.com') || $host === 'instagr.am') {
            return 'Instagram';
        }
        if (is_string($siteName) && trim($siteName) !== '') {
            return trim($siteName);
        }

        return $host !== '' ? $host : 'Link';
    }

    private function normalizeUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        if (! preg_match('#^https?://#i', $url)) {
            return null;
        }
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['host'])) {
            return null;
        }

        return $url;
    }

    private function absolutizeUrl(string $maybeRelative, string $base): ?string
    {
        $maybeRelative = trim($maybeRelative);
        if ($maybeRelative === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $maybeRelative)) {
            return $this->normalizeUrl($maybeRelative);
        }
        $baseParts = parse_url($base);
        if (! is_array($baseParts) || empty($baseParts['scheme']) || empty($baseParts['host'])) {
            return null;
        }
        $origin = $baseParts['scheme'].'://'.$baseParts['host'];
        if (! empty($baseParts['port'])) {
            $origin .= ':'.$baseParts['port'];
        }
        if (str_starts_with($maybeRelative, '//')) {
            return $this->normalizeUrl($baseParts['scheme'].':'.$maybeRelative);
        }
        if (str_starts_with($maybeRelative, '/')) {
            return $this->normalizeUrl($origin.$maybeRelative);
        }

        return $this->normalizeUrl($origin.'/'.$maybeRelative);
    }

    private function isPublicHttpUrl(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return false;
        }
        if ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return false;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
        }

        return true;
    }

    private function cleanText(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $text = trim(preg_replace('/\s+/', ' ', $value) ?? '');
        if ($text === '') {
            return null;
        }
        if (mb_strlen($text) > $max) {
            $text = rtrim(mb_substr($text, 0, $max - 1)).'…';
        }

        return $text;
    }
}
