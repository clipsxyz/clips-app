<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Free enrichment via Wikipedia (summary text) and Wikidata (population, area).
 * Google Places editorial_summary is sparse for cities; this fills the gap.
 */
class WikipediaPlaceEnricher
{
    private const USER_AGENT = 'GazetteerClipsApp/1.0 (location-feed; backend)';

    /**
     * @return array{
     *   name: string,
     *   tagline: string|null,
     *   summary: string,
     *   population: string|null,
     *   population_year: string|null,
     *   area: string|null,
     *   summary_source: string,
     *   facts: list<array{label: string, value: string}>
     * }|null
     */
    public function enrich(string $placeName, ?string $countryHint = null): ?array
    {
        $placeName = trim($placeName);
        if ($placeName === '') {
            return null;
        }

        $title = $this->resolveArticleTitle($placeName, $countryHint);
        if ($title === null) {
            return null;
        }

        $page = $this->fetchPageSummary($title);
        if ($page === null) {
            return null;
        }

        $displayName = trim((string) ($page['title'] ?? $placeName));
        $tagline = trim((string) ($page['description'] ?? ''));
        $extract = $this->cleanExtract((string) ($page['extract'] ?? ''));
        if ($extract === '' && $tagline === '') {
            return null;
        }

        $wikidataId = trim((string) ($page['wikidata_id'] ?? ''));
        $wikidataFacts = $wikidataId !== '' ? $this->fetchWikidataFacts($wikidataId) : [];

        $population = $wikidataFacts['population'] ?? null;
        $populationYear = $wikidataFacts['population_year'] ?? null;
        $area = $wikidataFacts['area'] ?? null;

        $facts = [];
        if ($population !== null) {
            $facts[] = [
                'label' => 'Population',
                'value' => $populationYear !== null ? "{$population} ({$populationYear})" : $population,
            ];
        }
        if ($area !== null) {
            $facts[] = ['label' => 'Area', 'value' => $area];
        }
        if ($countryHint !== null && trim($countryHint) !== '') {
            $facts[] = ['label' => 'Country', 'value' => trim($countryHint)];
        }

        $summary = $extract !== '' ? $this->truncateAtSentence($extract, 420) : $tagline;

        return [
            'name' => $displayName,
            'tagline' => $tagline !== '' ? $tagline : null,
            'summary' => $summary,
            'population' => $population,
            'population_year' => $populationYear,
            'area' => $area,
            'summary_source' => 'wikipedia',
            'facts' => $facts,
        ];
    }

    private function resolveArticleTitle(string $placeName, ?string $countryHint): ?string
    {
        $candidates = array_values(array_unique(array_filter([
            $placeName,
            $countryHint !== null && $countryHint !== '' ? "{$placeName}, {$countryHint}" : null,
        ])));

        foreach ($candidates as $candidate) {
            $payload = $this->httpGet('https://en.wikipedia.org/w/api.php', [
                'action' => 'opensearch',
                'search' => $candidate,
                'limit' => '1',
                'namespace' => '0',
                'format' => 'json',
            ]);
            if (! is_array($payload) || ! isset($payload[1][0])) {
                continue;
            }
            $title = trim((string) $payload[1][0]);
            if ($title !== '') {
                return $title;
            }
        }

        return $candidates[0] ?? null;
    }

    /**
     * @return array{title?: string, description?: string, extract?: string, wikidata_id?: string}|null
     */
    private function fetchPageSummary(string $title): ?array
    {
        $encoded = rawurlencode(str_replace(' ', '_', $title));
        $payload = $this->httpGet("https://en.wikipedia.org/api/rest_v1/page/summary/{$encoded}", []);
        if (! is_array($payload)) {
            return null;
        }
        if (($payload['type'] ?? '') === 'disambiguation') {
            return null;
        }

        return [
            'title' => (string) ($payload['title'] ?? $title),
            'description' => (string) ($payload['description'] ?? ''),
            'extract' => (string) ($payload['extract'] ?? ''),
            'wikidata_id' => (string) ($payload['wikibase_item'] ?? ''),
        ];
    }

    /**
     * @return array{population?: string, population_year?: string, area?: string}
     */
    private function fetchWikidataFacts(string $wikidataId): array
    {
        $id = strtoupper(trim($wikidataId));
        if (! preg_match('/^Q\d+$/', $id)) {
            return [];
        }

        $payload = $this->httpGet("https://www.wikidata.org/wiki/Special:EntityData/{$id}.json", []);
        if (! is_array($payload)) {
            return [];
        }

        $entity = $payload['entities'][$id] ?? null;
        if (! is_array($entity)) {
            return [];
        }

        $claims = is_array($entity['claims'] ?? null) ? $entity['claims'] : [];

        $population = $this->bestQuantityClaim($claims['P1082'] ?? null);
        $area = $this->bestQuantityClaim($claims['P2046'] ?? null);

        $out = [];
        if ($population !== null) {
            $out['population'] = $this->formatPopulation($population['amount']);
            $out['population_year'] = $population['year'];
        }
        if ($area !== null) {
            $out['area'] = $this->formatArea($area['amount']);
        }

        return $out;
    }

    /**
     * @param  mixed  $claimList
     * @return array{amount: float, year: string|null}|null
     */
    private function bestQuantityClaim(mixed $claimList): ?array
    {
        if (! is_array($claimList)) {
            return null;
        }

        $best = null;
        $bestYear = -1;

        foreach ($claimList as $claim) {
            if (! is_array($claim)) {
                continue;
            }
            $snak = $claim['mainsnak'] ?? null;
            if (! is_array($snak) || ($snak['snaktype'] ?? '') !== 'value') {
                continue;
            }
            $datavalue = $snak['datavalue']['value'] ?? null;
            if (! is_array($datavalue) || ! isset($datavalue['amount'])) {
                continue;
            }
            $amount = (float) str_replace('+', '', (string) $datavalue['amount']);
            $year = $this->claimPointInTimeYear($claim);
            $yearNum = $year !== null ? (int) $year : 0;
            if ($best === null || $yearNum >= $bestYear) {
                $best = ['amount' => $amount, 'year' => $year];
                $bestYear = $yearNum;
            }
        }

        return $best;
    }

    /**
     * @param  array<string, mixed>  $claim
     */
    private function claimPointInTimeYear(array $claim): ?string
    {
        $qualifiers = $claim['qualifiers']['P585'] ?? null;
        if (! is_array($qualifiers) || ! isset($qualifiers[0])) {
            return null;
        }
        $time = $qualifiers[0]['datavalue']['value']['time'] ?? null;
        if (! is_string($time) || ! preg_match('/^\+(\d{4})/', $time, $m)) {
            return null;
        }

        return $m[1];
    }

    public function formatPopulation(float $amount): string
    {
        $n = abs($amount);
        if ($n >= 1_000_000_000) {
            return round($n / 1_000_000_000, 1).' billion';
        }
        if ($n >= 1_000_000) {
            return round($n / 1_000_000, 1).' million';
        }
        if ($n >= 1_000) {
            return number_format((int) round($n));
        }

        return (string) (int) round($n);
    }

    public function formatArea(float $squareKm): string
    {
        if ($squareKm >= 1000) {
            return number_format((int) round($squareKm)).' km²';
        }
        if ($squareKm >= 1) {
            return round($squareKm, 0).' km²';
        }

        return round($squareKm, 2).' km²';
    }

    private function cleanExtract(string $text): string
    {
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
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

    /**
     * @param  array<string, string>  $query
     */
    private function httpGet(string $url, array $query): ?array
    {
        try {
            $request = Http::timeout(8)
                ->withHeaders(['User-Agent' => self::USER_AGENT]);
            $response = $query !== []
                ? $request->get($url, $query)
                : $request->get($url);
            if ($response->ok()) {
                $json = $response->json();
                if (is_array($json)) {
                    return $json;
                }
            }
        } catch (\Throwable $_) {
            // fall through
        }

        $fullUrl = $query !== [] ? $url.'?'.http_build_query($query) : $url;
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'header' => 'User-Agent: '.self::USER_AGENT."\r\n",
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($fullUrl, false, $context);
        if ($body === false) {
            return null;
        }
        $json = json_decode($body, true);

        return is_array($json) ? $json : null;
    }
}
