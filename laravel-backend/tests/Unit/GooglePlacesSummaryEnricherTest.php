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
}
