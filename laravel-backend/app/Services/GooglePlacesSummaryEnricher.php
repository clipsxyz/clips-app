<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Places API (New) — generativeSummary, neighborhoodSummary, reviewSummary,
 * plus landmark text-search pivot when city-level copy is too thin.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-summaries
 */
class GooglePlacesSummaryEnricher
{
    private const MIN_RICH_SUMMARY_CHARS = 60;

    /**
     * @return array{
     *   summary: string,
     *   summary_source: string,
     *   tagline?: string|null,
     *   attribution?: string|null
     * }|null
     */
    public function enrich(string $placeId, string $placeName, ?string $countryHint, string $apiKey): ?array
    {
        $placeId = $this->normalizePlaceId($placeId);
        $placeName = trim($placeName);
        if ($placeId === '' || $placeName === '') {
            return null;
        }

        $place = $this->fetchPlaceDetails($placeId, $apiKey);
        if ($place === null) {
            return null;
        }

        $displayName = $this->localizedText($place['displayName'] ?? null) ?: $placeName;
        $best = $this->pickBestFromPlace($place);

        if ($best === null || $this->isSummaryTooThin($best['text'])) {
            $landmark = $this->landmarkPivotSummary($displayName, $countryHint, $apiKey, $place);
            if ($landmark !== null) {
                $best = $landmark;
            }
        }

        if ($best === null || trim($best['text']) === '') {
            return null;
        }

        return [
            'summary' => $this->truncateAtSentence(trim($best['text']), 480),
            'summary_source' => $best['source'],
            'tagline' => $best['tagline'] ?? null,
            'attribution' => $best['attribution'] ?? null,
        ];
    }

    public function isSummaryTooThin(string $text): bool
    {
        $text = trim($text);
        if ($text === '') {
            return true;
        }
        $len = mb_strlen($text);
        if ($len < self::MIN_RICH_SUMMARY_CHARS) {
            return true;
        }
        if ($len < 140 && preg_match('/\bis a (city|country|local area|major city center)\b/i', $text)) {
            return true;
        }
        if ($len < 100 && preg_match('/\bis classified as\b/i', $text)) {
            return true;
        }

        return false;
    }

    /**
     * @return array{text: string, source: string, attribution?: string, tagline?: string}|null
     */
    private function pickBestFromPlace(array $place): ?array
    {
        $candidates = [];

        $gen = is_array($place['generativeSummary'] ?? null) ? $place['generativeSummary'] : [];
        $this->pushCandidate($candidates, $this->contentBlockText($gen['description'] ?? null), 'google_generative_description', $gen);
        $this->pushCandidate($candidates, $this->localizedText($gen['overview'] ?? null), 'google_generative_overview', $gen);

        $hood = is_array($place['neighborhoodSummary'] ?? null) ? $place['neighborhoodSummary'] : [];
        $this->pushCandidate($candidates, $this->contentBlockText($hood['description'] ?? null), 'google_neighborhood_description', $hood);
        $this->pushCandidate($candidates, $this->contentBlockText($hood['overview'] ?? null), 'google_neighborhood_overview', $hood);

        $review = is_array($place['reviewSummary'] ?? null) ? $place['reviewSummary'] : [];
        $this->pushCandidate($candidates, $this->localizedText($review['text'] ?? null), 'google_review_summary', $review);

        $this->pushCandidate(
            $candidates,
            $this->localizedText($place['editorialSummary'] ?? null),
            'google_editorial',
            null
        );

        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn ($a, $b) => mb_strlen($b['text']) <=> mb_strlen($a['text']));

        foreach ($candidates as $candidate) {
            if (! $this->isSummaryTooThin($candidate['text'])) {
                return $candidate;
            }
        }

        return $candidates[0];
    }

    /**
     * @param  list<array{text: string, source: string, attribution?: string}>  $candidates
     */
    private function pushCandidate(array &$candidates, string $text, string $source, ?array $disclosureSource): void
    {
        $text = trim($text);
        if ($text === '') {
            return;
        }
        $attribution = null;
        if (is_array($disclosureSource)) {
            $attribution = $this->localizedText($disclosureSource['disclosureText'] ?? null);
            if ($attribution === '') {
                $attribution = $this->localizedText($disclosureSource['disclaimerText'] ?? null);
            }
        }
        $candidates[] = [
            'text' => $text,
            'source' => $source,
            'attribution' => $attribution !== '' ? $attribution : null,
        ];
    }

    /**
     * @return array{text: string, source: string, attribution?: string, tagline?: string}|null
     */
    private function landmarkPivotSummary(
        string $cityName,
        ?string $countryHint,
        string $apiKey,
        ?array $cityPlace
    ): ?array {
        $query = $countryHint !== null && $countryHint !== ''
            ? "top tourist attractions in {$cityName}, {$countryHint}"
            : "top tourist attractions in {$cityName}";

        $body = ['textQuery' => $query, 'maxResultCount' => 8];
        $location = is_array($cityPlace['location'] ?? null) ? $cityPlace['location'] : null;
        if (is_array($location)) {
            $lat = $location['latitude'] ?? null;
            $lng = $location['longitude'] ?? null;
            if (is_numeric($lat) && is_numeric($lng)) {
                $body['locationBias'] = [
                    'circle' => [
                        'center' => ['latitude' => (float) $lat, 'longitude' => (float) $lng],
                        'radius' => 25000,
                    ],
                ];
            }
        }

        $payload = $this->placesPost(
            'https://places.googleapis.com/v1/places:searchText',
            $body,
            'places.id,places.displayName,places.generativeSummary,places.editorialSummary,places.primaryType',
            $apiKey
        );
        if (! is_array($payload)) {
            return null;
        }

        $places = is_array($payload['places'] ?? null) ? $payload['places'] : [];
        foreach ($places as $candidate) {
            if (! is_array($candidate)) {
                continue;
            }
            $landmarkName = $this->localizedText($candidate['displayName'] ?? null);
            if ($landmarkName === '' || mb_strtolower($landmarkName) === mb_strtolower($cityName)) {
                continue;
            }

            $snippet = $this->pickBestFromPlace($candidate);
            if ($snippet === null || $this->isSummaryTooThin($snippet['text'])) {
                continue;
            }

            $landmarkBlurb = rtrim($snippet['text'], '.');
            $text = "Known for landmarks like {$landmarkName}—{$landmarkBlurb}.";

            return [
                'text' => $text,
                'source' => 'google_landmark_pivot',
                'attribution' => $snippet['attribution'] ?? null,
                'tagline' => $landmarkName,
            ];
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fetchPlaceDetails(string $placeId, string $apiKey): ?array
    {
        $fieldMask = implode(',', [
            'id',
            'displayName',
            'formattedAddress',
            'types',
            'location',
            'generativeSummary',
            'neighborhoodSummary',
            'reviewSummary',
            'editorialSummary',
        ]);

        $payload = $this->placesGet(
            'https://places.googleapis.com/v1/places/'.$placeId,
            $fieldMask,
            $apiKey
        );

        return is_array($payload) ? $payload : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function placesGet(string $url, string $fieldMask, string $apiKey): ?array
    {
        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'X-Goog-Api-Key' => $apiKey,
                    'X-Goog-FieldMask' => $fieldMask,
                ])
                ->get($url);
            if ($response->ok()) {
                $json = $response->json();

                return is_array($json) ? $json : null;
            }
        } catch (\Throwable $_) {
            // stream fallback (Windows PHP SSL bundle)
        }

        return $this->httpGetFallback($url, [
            'X-Goog-Api-Key: '.$apiKey,
            'X-Goog-FieldMask: '.$fieldMask,
        ]);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>|null
     */
    private function placesPost(string $url, array $body, string $fieldMask, string $apiKey): ?array
    {
        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'X-Goog-Api-Key' => $apiKey,
                    'X-Goog-FieldMask' => $fieldMask,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $body);
            if ($response->ok()) {
                $json = $response->json();

                return is_array($json) ? $json : null;
            }
        } catch (\Throwable $_) {
            // stream fallback
        }

        $jsonBody = json_encode($body);
        if ($jsonBody === false) {
            return null;
        }

        return $this->httpPostFallback($url, $jsonBody, [
            'X-Goog-Api-Key: '.$apiKey,
            'X-Goog-FieldMask: '.$fieldMask,
            'Content-Type: application/json',
        ]);
    }

    /**
     * @param  list<string>  $headers
     * @return array<string, mixed>|null
     */
    private function httpGetFallback(string $url, array $headers): ?array
    {
        $headerLines = implode("\r\n", $headers);
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'header' => $headerLines."\r\n",
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null;
        }
        $json = json_decode($body, true);

        return is_array($json) ? $json : null;
    }

    /**
     * @param  list<string>  $headers
     * @return array<string, mixed>|null
     */
    private function httpPostFallback(string $url, string $jsonBody, array $headers): ?array
    {
        $headerLines = implode("\r\n", $headers);
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'timeout' => 8,
                'header' => $headerLines."\r\n",
                'content' => $jsonBody,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null;
        }
        $json = json_decode($body, true);

        return is_array($json) ? $json : null;
    }

    private function normalizePlaceId(string $placeId): string
    {
        $placeId = trim($placeId);
        if (str_starts_with($placeId, 'places/')) {
            return substr($placeId, 7);
        }

        return $placeId;
    }

    /**
     * @param  mixed  $value
     */
    private function localizedText(mixed $value): string
    {
        if (! is_array($value)) {
            return '';
        }

        return trim((string) ($value['text'] ?? ''));
    }

    /**
     * @param  mixed  $block
     */
    private function contentBlockText(mixed $block): string
    {
        if (! is_array($block)) {
            return '';
        }
        $fromContent = $this->localizedText($block['content'] ?? null);
        if ($fromContent !== '') {
            return $fromContent;
        }

        return $this->localizedText($block);
    }

    private function truncateAtSentence(string $text, int $maxLen): string
    {
        if (mb_strlen($text) <= $maxLen) {
            return $text;
        }
        $chunk = mb_substr($text, 0, $maxLen);
        if (preg_match('/^(.+[.!?])\s/u', $chunk, $m)) {
            return trim($m[1]);
        }

        return rtrim($chunk).'…';
    }
}
