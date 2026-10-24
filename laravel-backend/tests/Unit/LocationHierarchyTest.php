<?php

namespace Tests\Unit;

use App\Support\LocationHierarchy;
use PHPUnit\Framework\TestCase;

class LocationHierarchyTest extends TestCase
{
    public function test_identifies_countries_and_not_cities(): void
    {
        $this->assertTrue(LocationHierarchy::isCountry('Ireland'));
        $this->assertTrue(LocationHierarchy::isCountry('Spain'));
        $this->assertTrue(LocationHierarchy::isCountry('UK'));
        $this->assertFalse(LocationHierarchy::isCountry('Dublin'));
        $this->assertFalse(LocationHierarchy::isCountry('Manchester'));
        $this->assertFalse(LocationHierarchy::isCountry('Galway'));
    }

    public function test_maps_cities_back_to_their_country(): void
    {
        $this->assertSame('ireland', LocationHierarchy::countryForCity('Galway'));
        $this->assertSame('ireland', LocationHierarchy::countryForCity('Dublin'));
        $this->assertSame('spain', LocationHierarchy::countryForCity('Madrid'));
        $this->assertContains(LocationHierarchy::countryForCity('Manchester'), ['uk', 'united kingdom', 'england']);
        $this->assertNull(LocationHierarchy::countryForCity('Atlantis'));
    }

    public function test_parse_label_infers_ireland_from_galway(): void
    {
        $parsed = LocationHierarchy::parseLabel('Galway');

        $this->assertSame('Galway', $parsed['local']);
        $this->assertSame('Ireland', $parsed['national']);
    }

    public function test_compose_label_appends_missing_hierarchy(): void
    {
        $this->assertSame(
            'Phoenix Park, Dublin, Ireland',
            LocationHierarchy::composeLabel('Phoenix Park', 'Phoenix Park', 'Dublin', 'Ireland')
        );
    }
}
