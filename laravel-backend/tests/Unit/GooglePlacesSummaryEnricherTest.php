<?php

namespace Tests\Unit;

use App\Services\GooglePlacesSummaryEnricher;
use PHPUnit\Framework\TestCase;

class GooglePlacesSummaryEnricherTest extends TestCase
{
    public function test_thin_city_definition_is_detected(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertTrue($enricher->isSummaryTooThin('Paris is a city in France'));
        $this->assertFalse($enricher->isSummaryTooThin(
            'London is the capital and largest city of England and the United Kingdom, with a population of 9.1 million.'
        ));
    }

    public function test_empty_or_whitespace_summary_is_thin(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertTrue($enricher->isSummaryTooThin(''));
        $this->assertTrue($enricher->isSummaryTooThin('   '));
    }

    public function test_short_city_boilerplate_is_thin(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertTrue($enricher->isSummaryTooThin(
            'Paris is a city in France with a very long history, famous art, and vibrant culture.'
        ));
    }

    public function test_classified_as_boilerplate_is_thin_below_100_chars(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertTrue($enricher->isSummaryTooThin(
            'This destination is classified as a regional center by planners.'
        ));
    }

    public function test_long_boilerplate_is_fine(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertFalse($enricher->isSummaryTooThin(
            'This destination is classified as a major hub of commerce and trade, and it has grown steadily over the past few decades with new districts, parks, and cultural institutions appearing every single year.'
        ));
    }

    public function test_rich_paragraph_with_city_phrase_is_not_thin(): void
    {
        $enricher = new GooglePlacesSummaryEnricher;
        $this->assertFalse($enricher->isSummaryTooThin(
            'London is a city of historic importance, spanning the River Thames with landmarks such as the Tower of London, Big Ben, and Westminster Abbey, drawing millions of visitors from around the world every single year.'
        ));
    }
}