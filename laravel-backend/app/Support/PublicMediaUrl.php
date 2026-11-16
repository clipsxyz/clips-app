<?php

namespace App\Support;

/**
 * Turn stored media paths into a URL the current client can actually fetch.
 *
 * Uploads persist `APP_URL` (`http://localhost:8000/storage/...`). A physical
 * phone talking to Laravel over LAN (or only reversing Metro :8081) cannot
 * load that host — rewrite localhost / old LAN IPs onto this request's origin.
 */
class PublicMediaUrl
{
    public static function forClient(?string $url): ?string
    {
        $raw = trim((string) $url);
        if ($raw === '') {
            return null;
        }

        $lower = strtolower($raw);
        if (
            str_starts_with($lower, 'file:')
            || str_starts_with($lower, 'content:')
            || str_starts_with($lower, 'blob:')
            || str_starts_with($lower, 'ph:')
        ) {
            return null;
        }

        if (! preg_match('#^https?://#i', $raw)) {
            $raw = str_starts_with($raw, '/') ? url($raw) : url('/storage/'.$raw);
        }

        return self::rewriteDevHostToCurrentRequest($raw);
    }

    public static function rewriteDevHostToCurrentRequest(string $absolute): string
    {
        $request = request();
        if ($request === null) {
            return $absolute;
        }

        $parts = parse_url($absolute);
        $mediaHost = $parts['host'] ?? '';
        if ($mediaHost === '') {
            return $absolute;
        }

        $isDevHost = in_array($mediaHost, ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0'], true)
            || (bool) preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/', $mediaHost);
        if (! $isDevHost) {
            return $absolute;
        }

        $host = $request->getHost();
        if ($host === '') {
            return $absolute;
        }

        $scheme = $request->getScheme() ?: ($parts['scheme'] ?? 'http');
        $port = $request->getPort();
        $origin = $scheme.'://'.$host;
        if (is_int($port) && ! in_array($port, [80, 443], true)) {
            $origin .= ':'.$port;
        }

        $path = $parts['path'] ?? '';
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';

        return $origin.$path.$query;
    }

    /**
     * Rewrite every stored media field on a post payload so a previous
     * localhost or LAN address does not stay baked into the response.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function rewritePayloadMedia(array $payload): array
    {
        foreach (['media_url', 'final_video_url', 'thumbnail_url', 'video_poster_url', 'poster_url', 'avatar_url'] as $key) {
            if (! isset($payload[$key]) || ! is_string($payload[$key])) {
                continue;
            }
            $payload[$key] = self::forClient($payload[$key]) ?? $payload[$key];
        }

        if (isset($payload['media_items']) && is_array($payload['media_items'])) {
            $payload['media_items'] = array_map(function ($item) {
                if (! is_array($item)) {
                    return $item;
                }
                foreach (['url', 'media_url', 'video_url', 'poster_url', 'thumbnail_url', 'posterUrl', 'thumbnailUrl'] as $key) {
                    if (! isset($item[$key]) || ! is_string($item[$key])) {
                        continue;
                    }
                    $item[$key] = self::forClient($item[$key]) ?? $item[$key];
                }

                return $item;
            }, $payload['media_items']);
        }

        if (isset($payload['user']) && is_array($payload['user']) && isset($payload['user']['avatar_url']) && is_string($payload['user']['avatar_url'])) {
            $payload['user']['avatar_url'] = self::forClient($payload['user']['avatar_url']) ?? $payload['user']['avatar_url'];
        }

        return $payload;
    }
}
