<?php

namespace Tests\Unit;

use App\Services\PlaceFeedLevelParser;
use PHPUnit\Framework\TestCase;

class PlaceFeedLevelParserTest extends TestCase
{
    private PlaceFeedLevelParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new PlaceFeedLevelParser;
    }

    public function test_paris_france_city_is_regional_not_country(): void
    {
        $result = $this->parser->parse(
            [
                ['value' => 'Paris'],
                ['value' => 'France'],
            ],
            'Paris, France'
        );

        $this->assertSame('Paris', $result['local']);
        $this->assertSame('Paris', $result['regional']);
        $this->assertSame('France', $result['national']);
        $this->assertSame('regional', $result['feed_level']);
    }

    public function test_finglas_dublin_ireland_three_part(): void
    {
        $result = $this->parser->parse(
            [
                ['value' => 'Finglas'],
                ['value' => 'Dublin'],
                ['value' => 'Ireland'],
            ],
            'Finglas, Dublin, Ireland'
        );

        $this->assertSame('Finglas', $result['local']);
        $this->assertSame('Dublin', $result['regional']);
        $this->assertSame('Ireland', $result['national']);
        $this->assertSame('local', $result['feed_level']);
    }

    public function test_single_country(): void
    {
        $result = $this->parser->parse(
            [['value' => 'Ireland']],
            'Ireland'
        );

        $this->assertSame('Ireland', $result['national']);
        $this->assertSame('national', $result['feed_level']);
    }
}
