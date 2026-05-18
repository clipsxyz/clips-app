<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PlaceSummaryService
{
    private const CACHE_TTL_SECONDS = 259200; // 3 days

    public function __construct(
        private readonly WikipediaPlaceEnricher $wikipediaEnricher = new WikipediaPlaceEnricher,
        private readonly GooglePlacesSummaryEnricher $googleEnricher = new GooglePlacesSummaryEnricher
    ) {}

    /**
     * @return array{
     *   name: string,
     *   formatted_address: string|null,
     *   summary: string|null,
     *   summary_source: string|null,
     *   tagline?: string|null,
     *   facts?: list<array{label: string, value: string}>
     * }|null
     */
    public function summarize(?string $placeId, string $label): ?array
    {
        $label = trim($label);
        if ($label === '') {
            return null;
        }

        $cacheKey = 'place_summary:v4:'.sha1(strtolower($placeId ?: '').'|'.strtolower($label));
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $countryHint = $this->countryFromLabel($label);
        $primaryName = trim(explode(',', $label)[0] ?? $label);

        $name = $primaryName;
        $formattedAddress = null;
        $types = [];

        $apiKey = config('services.google_maps.api_key');
        $resolvedPlaceId = null;
        if (is_string($apiKey) && trim($apiKey) !== '') {
            $apiKey = trim($apiKey);
            $resolvedPlaceId = $placeId !== null && trim($placeId) !== ''
                ? trim($placeId)
                : $this->findPlaceId($label, $apiKey);

            if ($resolvedPlaceId !== null) {
                $google = $this->googleEnricher->enrich($resolvedPlaceId, $name, $countryHint, $apiKey);
                if ($google !== null) {
                    $name = $name ?: $primaryName;
                    $wiki = $this->wikipediaEnricher->enrich($name, $countryHint);
                    $result = $this->buildFinalResult(
                        $name,
                        $formattedAddress,
                        $google,
                        $wiki,
                        $countryHint
                    );
                    Cache::put($cacheKey, $result, self::CACHE_TTL_SECONDS);

                    return $result;
                }

                $legacy = $this->placeDetails($resolvedPlaceId, $apiKey);
                if (is_array($legacy)) {
                    $name = trim((string) ($legacy['name'] ?? $primaryName));
                    $formattedAddress = isset($legacy['formatted_address'])
                        ? (string) $legacy['formatted_address']
                        : null;
                    $types = is_array($legacy['types'] ?? null) ? $legacy['types'] : [];
                    $countryHint = $countryHint ?? $this->countryFromAddress($formattedAddress);
                }
            }
        }

        $wiki = $this->wikipediaEnricher->enrich($name, $countryHint);
        if ($wiki !== null) {
            $result = $this->mergeResult([
                'name' => $name,
                'formatted_address' => $formattedAddress ?? $this->formatAddress($name, $countryHint),
                'summary' => $wiki['summary'],
                'summary_source' => $wiki['summary_source'],
                'tagline' => $wiki['tagline'],
                'facts' => $wiki['facts'],
            ], null);
            Cache::put($cacheKey, $result, self::CACHE_TTL_SECONDS);

            return $result;
        }

        if ($types !== []) {
            $typesSummary = $this->summaryFromTypes($types, $name);
            if ($typesSummary !== null) {
                $result = [
                    'name' => $name,
                    'formatted_address' => $formattedAddress,
                    'summary' => $typesSummary,
                    'summary_source' => 'types_fallback',
                ];
                Cache::put($cacheKey, $result, self::CACHE_TTL_SECONDS);

                return $result;
            }
        }

        $gazetteer = $this->gazetteerFallback($label);
        if ($gazetteer !== null) {
            Cache::put($cacheKey, $gazetteer, self::CACHE_TTL_SECONDS);
        }

        return $gazetteer;
    }

    /**
     * Prefer Google AI/landmark copy for the narrative; Wikipedia for population/facts.
     *
     * @param  array<string, mixed>  $google
     * @param  array<string, mixed>|null  $wiki
     * @return array<string, mixed>
     */
    private function buildFinalResult(
        string $name,
        ?string $formattedAddress,
        array $google,
        ?array $wiki,
        ?string $countryHint
    ): array {
        $googleSummary = trim((string) ($google['summary'] ?? ''));
        $wikiSummary = is_array($wiki) ? trim((string) ($wiki['summary'] ?? '')) : '';

        // Keep Google generative / landmark pivot when rich; Wikipedia fills gaps + facts grid.
        $useWikiNarrative = $wikiSummary !== ''
            && ($googleSummary === '' || $this->googleEnricher->isSummaryTooThin($googleSummary));

        $base = [
            'name' => $name,
            'formatted_address' => $formattedAddress ?? $this->formatAddress($name, $countryHint),
            'summary' => $useWikiNarrative ? $wikiSummary : $googleSummary,
            'summary_source' => $useWikiNarrative
                ? (string) ($wiki['summary_source'] ?? 'wikipedia')
                : (string) ($google['summary_source'] ?? 'google'),
            'tagline' => $useWikiNarrative
                ? ($wiki['tagline'] ?? $google['tagline'] ?? null)
                : ($google['tagline'] ?? $wiki['tagline'] ?? null),
        ];

        if (! $useWikiNarrative && ! empty($google['attribution'])) {
            $base['attribution'] = (string) $google['attribution'];
        }

        return $this->mergeResult($base, $wiki);
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<string, mixed>|null  $wiki
     * @return array<string, mixed>
     */
    private function mergeResult(array $base, ?array $wiki): array
    {
        if ($wiki === null) {
            return $base;
        }

        $facts = is_array($base['facts'] ?? null) ? $base['facts'] : [];
        $wikiFacts = is_array($wiki['facts'] ?? null) ? $wiki['facts'] : [];
        $mergedFacts = $wikiFacts !== [] ? $wikiFacts : $facts;

        if ($mergedFacts === [] && ! empty($wiki['population'])) {
            $pop = (string) $wiki['population'];
            $year = isset($wiki['population_year']) ? (string) $wiki['population_year'] : null;
            $mergedFacts[] = [
                'label' => 'Population',
                'value' => $year !== null && $year !== '' ? "{$pop} ({$year})" : $pop,
            ];
        }

        $out = $base;
        if (! empty($mergedFacts)) {
            $out['facts'] = $mergedFacts;
        }
        if (empty($out['tagline']) && ! empty($wiki['tagline'])) {
            $out['tagline'] = $wiki['tagline'];
        }

        return $out;
    }

    private function countryFromLabel(string $label): ?string
    {
        $parts = array_map('trim', explode(',', $label));
        if (count($parts) < 2) {
            return null;
        }

        return $parts[count($parts) - 1] !== '' ? $parts[count($parts) - 1] : null;
    }

    private function countryFromAddress(?string $address): ?string
    {
        if ($address === null || trim($address) === '') {
            return null;
        }
        $parts = array_map('trim', explode(',', $address));

        return $parts !== [] ? ($parts[count($parts) - 1] ?: null) : null;
    }

    private function formatAddress(string $name, ?string $country): ?string
    {
        if ($country === null || $country === '') {
            return $name;
        }

        return "{$name}, {$country}";
    }

    private function findPlaceId(string $input, string $apiKey): ?string
    {
        $payload = $this->googleGet('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', [
            'input' => $input,
            'inputtype' => 'textquery',
            'fields' => 'place_id',
            'key' => $apiKey,
        ]);
        if (! is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }
        $candidates = is_array($payload['candidates'] ?? null) ? $payload['candidates'] : [];
        $first = $candidates[0] ?? null;
        if (! is_array($first)) {
            return null;
        }
        $id = trim((string) ($first['place_id'] ?? ''));

        return $id !== '' ? $id : null;
    }

    /**
     * @return array{name?: string, formatted_address?: string, editorial_summary?: array, types?: list<string>}|null
     */
    private function placeDetails(string $placeId, string $apiKey): ?array
    {
        $payload = $this->googleGet('https://maps.googleapis.com/maps/api/place/details/json', [
            'place_id' => $placeId,
            'fields' => 'name,formatted_address,editorial_summary,types',
            'key' => $apiKey,
        ]);
        if (! is_array($payload) || ($payload['status'] ?? '') !== 'OK') {
            return null;
        }
        $result = $payload['result'] ?? null;

        return is_array($result) ? $result : null;
    }

    /**
     * @param  list<string>|array<int, string>  $types
     */
    public function summaryFromTypes(array $types, string $name): ?string
    {
        $label = $this->primaryTypeLabel($types);
        if ($label === null) {
            return null;
        }

        return "{$name} is classified as a {$label}. Be the first to share what's happening here.";
    }

    /**
     * @param  list<string>|array<int, string>  $types
     */
    public function primaryTypeLabel(array $types): ?string
    {
        $normalized = array_map(fn ($t) => strtolower((string) $t), $types);
        $priority = [
            'locality' => 'major city center',
            'administrative_area_level_1' => 'region',
            'administrative_area_level_2' => 'county or district',
            'country' => 'country',
            'neighborhood' => 'neighborhood',
            'sublocality' => 'local area',
            'sublocality_level_1' => 'local area',
            'tourist_attraction' => 'tourist attraction',
            'museum' => 'museum',
            'park' => 'park',
            'natural_feature' => 'natural landmark',
            'point_of_interest' => 'point of interest',
        ];
        foreach ($priority as $type => $label) {
            if (in_array($type, $normalized, true)) {
                return $label;
            }
        }

        return null;
    }

    /**
     * @return array{
     *   name: string,
     *   formatted_address: string|null,
     *   summary: string|null,
     *   summary_source: string|null
     * }|null
     */
    private function gazetteerFallback(string $label): ?array
    {
        $path = storage_path('app/data/locations.json');
        if (! file_exists($path)) {
            return null;
        }
        $data = json_decode((string) file_get_contents($path), true);
        if (! is_array($data)) {
            return null;
        }
        $needle = strtolower(trim($label));
        foreach ($data as $item) {
            if (! is_array($item)) {
                continue;
            }
            $name = trim((string) ($item['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $country = trim((string) ($item['country'] ?? ''));
            $haystacks = array_filter([
                strtolower($name),
                strtolower("{$name}, {$country}"),
            ]);
            if (! in_array($needle, $haystacks, true) && ! str_starts_with($needle, strtolower($name))) {
                continue;
            }

            $wiki = $this->wikipediaEnricher->enrich($name, $country !== '' ? $country : null);
            if ($wiki !== null) {
                return $this->mergeResult([
                    'name' => $name,
                    'formatted_address' => $country !== '' ? "{$name}, {$country}" : $name,
                    'summary' => $wiki['summary'],
                    'summary_source' => $wiki['summary_source'],
                    'tagline' => $wiki['tagline'],
                    'facts' => $wiki['facts'],
                ], null);
            }

            $type = (string) ($item['type'] ?? 'location');
            $typePhrase = match ($type) {
                'city' => 'city',
                'local' => 'local area',
                'country' => 'country',
                default => 'place',
            };
            $address = $country !== '' ? "{$name}, {$country}" : $name;
            $summary = $country !== ''
                ? "{$name} is a {$typePhrase} in {$country}. Be the first to share what's happening here."
                : "{$name} is a {$typePhrase}. Be the first to share what's happening here.";

            return [
                'name' => $name,
                'formatted_address' => $address,
                'summary' => $summary,
                'summary_source' => 'gazetteer_fallback',
            ];
        }

        return null;
    }

    /**
     * @param  array<string, string>  $query
     */
    private function googleGet(string $baseUrl, array $query): ?array
    {
        try {
            $response = Http::timeout(6)->get($baseUrl, $query);
            if ($response->ok()) {
                $payload = $response->json();
                if (is_array($payload)) {
                    return $payload;
                }
            }
        } catch (\Throwable $_) {
            // stream fallback below
        }

        $url = $baseUrl.'?'.http_build_query($query);
        $context = stream_context_create([
            'http' => ['timeout' => 6],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null;
        }
        $payload = json_decode($body, true);

        return is_array($payload) ? $payload : null;
    }
}
