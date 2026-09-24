<?php

namespace Tests\Feature;

use App\Services\GooglePlacesSummaryEnricher;
use App\Services\PlaceSummaryService;
use App\Services\WikipediaPlaceEnricher;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlaceEnrichmentIntegrationTest extends TestCase
{
    private function fakeGeocoding(array $fakes = []): void
    {
        Http::fake([
            '*maps.googleapis.com/maps/api/place/findplacefromtext*' => $fakes['findplacefromtext'] ?? Http::response([], 200),
            '*maps.googleapis.com/maps/api/place/details*' => $fakes['legacy_details'] ?? Http::response([], 200),
            '*places.googleapis.com/v1/places:searchText*' => $fakes['search_text'] ?? Http::response([], 200),
            '*places.googleapis.com/v1/places/*' => $fakes['new_details'] ?? Http::response([], 200),
            '*en.wikipedia.org/w/api.php*' => $fakes['opensearch'] ?? Http::response([], 200),
            '*en.wikipedia.org/api/rest_v1/page/summary/*' => $fakes['page_summary'] ?? Http::response([], 200),
            '*wikidata.org/wiki/Special:EntityData/*' => $fakes['wikidata'] ?? Http::response([], 200),
            '*' => Http::response([], 200),
        ]);
    }

    private function parisOpensearch(): array
    {
        return ['Paris', ['Paris'], [''], ['']];
    }

    private function parisPageSummary(): array
    {
        return [
            'title' => 'Paris',
            'description' => 'Capital city',
            'extract' => 'Paris is the capital and most populous city of France, with an estimated population of 2.1 million residents in 2022.',
            'wikibase_item' => 'Q90',
        ];
    }

    private function parisWikidata(): array
    {
        return [
            'entities' => [
                'Q90' => [
                    'claims' => [
                        'P1082' => [
                            [
                                'mainsnak' => [
                                    'snaktype' => 'value',
                                    'datavalue' => [
                                        'value' => [
                                            'amount' => '+2148271',
                                            'unit' => 'http://www.wikidata.org/entity/Q11573',
                                        ],
                                    ],
                                ],
                                'qualifiers' => [
                                    'P585' => [[
                                        'datavalue' => ['value' => ['time' => '+2022-01-01T00:00:00Z']],
                                    ]],
                                ],
                            ],
                        ],
                        'P2046' => [
                            [
                                'mainsnak' => [
                                    'snaktype' => 'value',
                                    'datavalue' => [
                                        'value' => [
                                            'amount' => '+105.4',
                                            'unit' => 'http://www.wikidata.org/entity/Q11573',
                                        ],
                                    ],
                                ],
                                'qualifiers' => [],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_wikipedia_enrich_builds_summary_facts_and_country(): void
    {
        $this->fakeGeocoding([
            'opensearch' => Http::response($this->parisOpensearch()),
            'page_summary' => Http::response($this->parisPageSummary()),
            'wikidata' => Http::response($this->parisWikidata()),
        ]);

        $result = (new WikipediaPlaceEnricher)->enrich('Paris', 'France');

        $this->assertNotNull($result);
        $this->assertSame('Paris', $result['name']);
        $this->assertSame('Capital city', $result['tagline']);
        $this->assertSame('wikipedia', $result['summary_source']);
        $this->assertSame($this->parisPageSummary()['extract'], $result['summary']);
        $this->assertSame('2.1 million', $result['population']);
        $this->assertSame('2022', $result['population_year']);
        $this->assertSame('105 km²', $result['area']);
        $this->assertSame([
            ['label' => 'Population', 'value' => '2.1 million (2022)'],
            ['label' => 'Area', 'value' => '105 km²'],
            ['label' => 'Country', 'value' => 'France'],
        ], $result['facts']);
    }

    public function test_wikipedia_enrich_returns_null_for_blank_name(): void
    {
        $this->assertNull((new WikipediaPlaceEnricher)->enrich('   '));
    }

    public function test_wikipedia_enrich_returns_null_for_disambiguation_page(): void
    {
        $this->fakeGeocoding([
            'opensearch' => Http::response($this->parisOpensearch()),
            'page_summary' => Http::response(['type' => 'disambiguation', 'title' => 'Paris']),
        ]);

        $this->assertNull((new WikipediaPlaceEnricher)->enrich('Paris', 'France'));
    }

    public function test_google_enrich_uses_generative_summary_and_truncates(): void
    {
        $longOverview = str_repeat('Paris is the capital of France, known for its art, food, and architecture. ', 7);
        $this->fakeGeocoding([
            'new_details' => Http::response([
                'displayName' => ['text' => 'Paris'],
                'generativeSummary' => [
                    'overview' => ['text' => $longOverview],
                    'disclosureText' => ['text' => 'Data provided by Google.'],
                ],
            ]),
        ]);

        $result = (new GooglePlacesSummaryEnricher)->enrich('places/ChIJU9d', 'Paris', 'France', 'test-key');

        $this->assertNotNull($result);
        $this->assertSame('google_generative_overview', $result['summary_source']);
        $this->assertSame('Data provided by Google.', $result['attribution']);
        $this->assertLessThan(mb_strlen($longOverview), mb_strlen($result['summary']));
        $this->assertLessThanOrEqual(480, mb_strlen($result['summary']));
        $this->assertStringStartsWith('Paris is the capital of France', $result['summary']);
    }

    public function test_google_enrich_falls_back_to_landmark_pivot_when_thin(): void
    {
        $this->fakeGeocoding([
            'new_details' => Http::response([
                'displayName' => ['text' => 'Paris'],
                'location' => ['latitude' => 48.85, 'longitude' => 2.35],
                'editorialSummary' => ['text' => 'Paris is a city in France and the capital.'],
            ]),
            'search_text' => Http::response([
                'places' => [
                    [
                        'displayName' => ['text' => 'Eiffel Tower'],
                        'generativeSummary' => [
                            'overview' => [
                                'text' => 'A wrought-iron lattice tower on the Champ de Mars that attracts millions of visitors every year and is an iconic symbol of Paris across the whole world.',
                            ],
                        ],
                    ],
                    ['displayName' => ['text' => 'Paris']],
                ],
            ]),
        ]);

        $result = (new GooglePlacesSummaryEnricher)->enrich('ChIJU9d', 'Paris', 'France', 'test-key');

        $this->assertNotNull($result);
        $this->assertSame('google_landmark_pivot', $result['summary_source']);
        $this->assertSame('Eiffel Tower', $result['tagline']);
        $this->assertStringStartsWith('Known for landmarks like Eiffel Tower—', $result['summary']);
        $this->assertStringEndsWith('.', trim($result['summary']));
    }

    public function test_google_enrich_returns_null_for_blank_inputs(): void
    {
        $this->fakeGeocoding();
        $enricher = new GooglePlacesSummaryEnricher;

        $this->assertNull($enricher->enrich('', 'Paris', 'France', 'key'));
        $this->assertNull($enricher->enrich('ChIJx', '   ', 'France', 'key'));
    }

    public function test_google_enrich_returns_null_when_details_unavailable(): void
    {
        $this->fakeGeocoding();
        $this->assertNull((new GooglePlacesSummaryEnricher)->enrich('ChIJnothing', 'Paris', 'France', 'key'));
    }

    public function test_place_summary_service_google_flow_prefers_google_narrative_with_wiki_facts_and_caches(): void
    {
        $rich = 'Paris is the capital and most populous city of France, home to the Louvre, the Eiffel Tower, and world-class museums and culture.';
        $this->fakeGeocoding([
            'findplacefromtext' => Http::response(['status' => 'OK', 'candidates' => [['place_id' => 'ChIJgoogle']]]),
            'new_details' => Http::response([
                'displayName' => ['text' => 'Paris'],
                'generativeSummary' => ['overview' => ['text' => $rich]],
            ]),
            'opensearch' => Http::response($this->parisOpensearch()),
            'page_summary' => Http::response($this->parisPageSummary()),
            'wikidata' => Http::response($this->parisWikidata()),
        ]);
        config(['services.google_maps.api_key' => 'test-key']);

        $service = new PlaceSummaryService;
        $result = $service->summarize('ChIJgoogle', 'Paris, France');

        $this->assertNotNull($result);
        $this->assertSame('Paris', $result['name']);
        $this->assertSame('Paris, France', $result['formatted_address']);
        $this->assertSame($rich, $result['summary']);
        $this->assertSame('google_generative_overview', $result['summary_source']);
        $this->assertSame(
            [
                ['label' => 'Population', 'value' => '2.1 million (2022)'],
                ['label' => 'Area', 'value' => '105 km²'],
                ['label' => 'Country', 'value' => 'France'],
            ],
            $result['facts']
        );

        $requestsAfterFirstCall = count(Http::recorded());
        $second = $service->summarize('ChIJgoogle', 'Paris, France');
        $this->assertSame($result, $second);
        $this->assertSame($requestsAfterFirstCall, count(Http::recorded()));
    }

    public function test_place_summary_service_falls_back_to_wikipedia_without_api_key(): void
    {
        $this->fakeGeocoding([
            'opensearch' => Http::response($this->parisOpensearch()),
            'page_summary' => Http::response($this->parisPageSummary()),
            'wikidata' => Http::response($this->parisWikidata()),
        ]);
        config(['services.google_maps.api_key' => null]);

        $result = (new PlaceSummaryService)->summarize(null, 'Paris, France');

        $this->assertNotNull($result);
        $this->assertSame('Paris', $result['name']);
        $this->assertSame('Paris, France', $result['formatted_address']);
        $this->assertSame('wikipedia', $result['summary_source']);
        $this->assertSame('2.1 million (2022)', $result['facts'][0]['value']);
    }

    public function test_place_summary_service_uses_types_fallback_when_all_enrichment_missing(): void
    {
        $this->fakeGeocoding([
            'findplacefromtext' => Http::response(['status' => 'OK', 'candidates' => [['place_id' => 'ChIJlegacy']]]),
            'legacy_details' => Http::response([
                'status' => 'OK',
                'result' => [
                    'name' => 'Paris',
                    'formatted_address' => 'Paris, France',
                    'types' => ['locality'],
                ],
            ]),
        ]);
        config(['services.google_maps.api_key' => 'test-key']);

        $result = (new PlaceSummaryService)->summarize(null, 'Paris');

        $this->assertNotNull($result);
        $this->assertSame('types_fallback', $result['summary_source']);
        $this->assertSame('Paris, France', $result['formatted_address']);
        $this->assertSame('Paris is classified as a major city center. Be the first to share what\'s happening here.', $result['summary']);
    }

    public function test_place_summary_service_returns_null_for_blank_label(): void
    {
        $this->assertNull((new PlaceSummaryService)->summarize(null, '   '));
    }
}