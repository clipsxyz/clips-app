<?php

namespace Tests\Unit;

use App\Services\WikipediaPlaceEnricher;
use PHPUnit\Framework\TestCase;

class WikipediaPlaceEnricherTest extends TestCase
{
    public function test_format_population_millions(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('9.6 million', $enricher->formatPopulation(9_648_110));
    }

    public function test_format_area_km(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('1,572 km²', $enricher->formatArea(1572));
    }
}
