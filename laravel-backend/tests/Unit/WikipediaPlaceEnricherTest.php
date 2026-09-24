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

    public function test_format_population_billions(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('1.4 billion', $enricher->formatPopulation(1_400_000_000));
        $this->assertSame('2.1 billion', $enricher->formatPopulation(2_148_271_000));
    }

    public function test_format_population_thousands(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('12,345', $enricher->formatPopulation(12_345));
        $this->assertSame('1,000', $enricher->formatPopulation(1000));
    }

    public function test_format_population_small(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('999', $enricher->formatPopulation(999));
        $this->assertSame('42', $enricher->formatPopulation(42));
    }

    public function test_format_area_km(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('1,572 km²', $enricher->formatArea(1572));
    }

    public function test_format_area_large_threshold(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('9,984,670 km²', $enricher->formatArea(9_984_670));
        $this->assertSame('100 km²', $enricher->formatArea(100));
        $this->assertSame('105 km²', $enricher->formatArea(105.4));
    }

    public function test_format_area_sub_kilometre(): void
    {
        $enricher = new WikipediaPlaceEnricher;
        $this->assertSame('0.5 km²', $enricher->formatArea(0.5));
        $this->assertSame('0.12 km²', $enricher->formatArea(0.12));
    }
}