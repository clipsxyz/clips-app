<?php

namespace Tests\Unit;

use App\Services\Mp4FaststartService;
use PHPUnit\Framework\TestCase;

class Mp4FaststartServiceTest extends TestCase
{
    public function test_remux_command_copies_streams_and_moves_moov_atom(): void
    {
        $cmd = Mp4FaststartService::remuxCommand('/usr/bin/ffmpeg', '/in/clip.mp4', '/out/clip.mp4');

        $this->assertStringContainsString('-c copy', $cmd);
        $this->assertStringContainsString('-movflags +faststart', $cmd);
        $this->assertStringContainsString('/in/clip.mp4', $cmd);
        $this->assertStringContainsString('/out/clip.mp4', $cmd);
    }
}
