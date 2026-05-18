<?php

namespace Tests\Unit;

use App\Services\PlaceSummaryService;
use PHPUnit\Framework\TestCase;

class PlaceSummaryServiceTest extends TestCase
{
    public function test_summary_from_types_for_locality(): void
    {
        $service = new PlaceSummaryService;
        $summary = $service->summaryFromTypes(['locality', 'political'], 'Paris');
        $this->assertStringContainsString('major city center', (string) $summary);
        $this->assertStringContainsString('Paris', (string) $summary);
    }

    public function test_primary_type_label_prefers_locality(): void
    {
        $service = new PlaceSummaryService;
        $this->assertSame('major city center', $service->primaryTypeLabel(['political', 'locality']));
    }
}
