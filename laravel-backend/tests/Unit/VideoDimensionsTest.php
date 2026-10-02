<?php

namespace Tests\Unit;

use App\Support\VideoDimensions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for the MP4/ISO-BMFF metadata reader.
 *
 * These are unit tests with NO database and NO fixtures on disk: the MP4 byte streams are
 * synthesised in-memory, so the assertions pin the container-parsing behaviour itself
 * rather than whatever a particular encoder happened to emit.
 *
 * The real-world calibration came from the 67 production uploads already in
 * storage/app/public/uploads: 67/67 parse, returning e.g. 405x720 (exactly 9:16) and
 * 720x540 (4:3). One additional ".mp4" there is a 22-byte stub and correctly returns null.
 */
class VideoDimensionsTest extends TestCase
{
    public function test_reads_landscape_dimensions_from_tkhd(): void
    {
        $bytes = $this->mp4(width: 1920, height: 1080);

        $this->assertSame(['width' => 1920, 'height' => 1080], VideoDimensions::fromBytes($bytes));
    }

    public function test_reads_portrait_dimensions_from_tkhd(): void
    {
        // The exact shape of the production clips: 405x720 is precisely 9:16.
        $bytes = $this->mp4(width: 405, height: 720);

        $this->assertSame(['width' => 405, 'height' => 720], VideoDimensions::fromBytes($bytes));
        $this->assertSame(0.5625, 405 / 720);
    }

    public function test_returns_null_when_there_is_no_moov_box(): void
    {
        $this->assertNull(VideoDimensions::fromBytes('not an mp4 at all'));
        $this->assertNull(VideoDimensions::fromBytes(''));
        $this->assertNull(VideoDimensions::fromBytes('ab'));
    }

    public function test_returns_null_for_a_truncated_stream(): void
    {
        $bytes = $this->mp4(width: 1920, height: 1080);

        // Cutting mid-box must not throw or invent a size.
        $this->assertNull(VideoDimensions::fromBytes(substr($bytes, 0, 60)));
    }

    public function test_returns_null_when_tkhd_reports_zero_dimensions(): void
    {
        // An audio-only file has a video-shaped trak with a 0x0 tkhd; guessing from it
        // would put a 0-height box in the feed.
        $bytes = $this->mp4(width: 0, height: 0);

        $this->assertNull(VideoDimensions::fromBytes($bytes));
    }

    public function test_returns_null_for_absurdly_large_dimensions(): void
    {
        $bytes = $this->mp4(width: 99999, height: 10);

        $this->assertNull(VideoDimensions::fromBytes($bytes));
    }

    public function test_skips_the_audio_track_and_uses_the_video_track(): void
    {
        $bytes = $this->mp4(width: 1920, height: 1080, audioFirst: true);

        $result = VideoDimensions::fromBytes($bytes);

        $this->assertSame(['width' => 1920, 'height' => 1080], $result);
    }

    public function test_applies_a_quarter_turn_rotation_matrix(): void
    {
        // A phone records 1920x1080 with a 90-degree matrix; the displayed frame is
        // portrait. Reading it unrotated is the classic "vertical clip renders as a
        // landscape letterbox" bug, so this asserts the swap happens.
        $bytes = $this->mp4(width: 1920, height: 1080, rotateQuarterTurn: true);

        $this->assertSame(['width' => 1080, 'height' => 1920], VideoDimensions::fromBytes($bytes));
    }

    public function test_inspect_returns_null_for_unknown_containers(): void
    {
        $tmp = tempnam(sys_get_temp_dir(), 'vd');
        file_put_contents($tmp, "\x1a\x45\xdf\xa3webm-not-parsed");

        $this->assertNull(VideoDimensions::inspect($tmp));
        unlink($tmp);
    }

    public function test_inspect_returns_null_for_a_missing_file(): void
    {
        $this->assertNull(VideoDimensions::fromFile('/no/such/file.mp4'));
        $this->assertNull(VideoDimensions::fromFile(''));
    }

    public function test_from_file_reads_dimensions_off_disk(): void
    {
        $tmp = tempnam(sys_get_temp_dir(), 'vd').'.mp4';
        file_put_contents($tmp, $this->mp4(width: 720, height: 1280));

        $this->assertSame(['width' => 720, 'height' => 1280], VideoDimensions::fromFile($tmp));

        unlink($tmp);
    }

    /**
     * Build a minimal but structurally valid MP4: ftyp + moov(mvhd, trak(tkhd, mdia(hdlr, …))).
     *
     * @param  bool  $rotateQuarterTurn  set a 90-degree display matrix
     * @param  bool  $audioFirst  put an 'soun' trak before the 'vide' trak
     */
    private function mp4(
        int $width,
        int $height,
        bool $rotateQuarterTurn = false,
        bool $audioFirst = false,
    ): string {
        $videoTrak = $this->trak(
            trackId: 1,
            handler: 'vide',
            width: $width,
            height: $height,
            rotateQuarterTurn: $rotateQuarterTurn,
        );
        $audioTrak = $this->trak(trackId: 2, handler: 'soun', width: 0, height: 0);

        $traks = $audioFirst ? $audioTrak.$videoTrak : $videoTrak.$audioTrak;

        $ftyp = $this->box('ftyp', 'isom'."\x00\x00\x02\x00".'isomiso2avc1mp41');
        $moov = $this->box('moov', $this->box('mvhd', str_repeat("\x00", 100)).$traks);

        return $ftyp.$moov;
    }

    private function trak(int $trackId, string $handler, int $width, int $height, bool $rotateQuarterTurn = false): string
    {
        // tkhd payload: version+flags(4) created(4) modified(4) track_ID(4) reserved(4)
        //                duration(4) reserved(8) layer(2) alt(2) volume(2) reserved(2)
        //                matrix(36) width(4) height(4) = 84 bytes
        $tkhd = "\x00\x00\x00\x00"
            .pack('N', 0).pack('N', 0).pack('N', $trackId).pack('N', 0).pack('N', 1000)
            .str_repeat("\x00", 8)
            ."\x00\x00"."\x00\x00"."\x00\x00"."\x00\x00"
            .$this->matrix($rotateQuarterTurn)
            .pack('N', $width * 65536).pack('N', $height * 65536);

        // hdlr payload: version+flags(4) pre_defined(4) handler_type(4) reserved(12) name
        $hdlr = "\x00\x00\x00\x00".pack('N', 0).$handler.str_repeat("\x00", 12)."\x00";

        $mdia = $this->box('mdia',
            $this->box('mdhd', str_repeat("\x00", 24))
            .$this->box('hdlr', $hdlr)
            .$this->box('minf', str_repeat("\x00", 8))
        );

        return $this->box('trak', $this->box('tkhd', $tkhd).$mdia);
    }

    /** 36-byte 3x3 display matrix in 16.16 fixed point. */
    private function matrix(bool $rotateQuarterTurn): string
    {
        if ($rotateQuarterTurn) {
            // a=0 b=1 u=-1 v=0  -> 90 degrees
            return $this->fixed(0).$this->fixed(1).$this->fixed(-1).$this->fixed(0)
                .$this->fixed(0).$this->fixed(0).$this->fixed(0).$this->fixed(1)
                .$this->fixed(0);
        }

        // identity
        return $this->fixed(1).$this->fixed(0).$this->fixed(0).$this->fixed(0)
            .$this->fixed(0).$this->fixed(0).$this->fixed(0).$this->fixed(1)
            .$this->fixed(0);
    }

    private function fixed(float $value): string
    {
        return pack('N', (int) round($value * 65536) & 0xFFFFFFFF);
    }

    private function box(string $type, string $payload): string
    {
        return pack('N', strlen($payload) + 8).$type.$payload;
    }
}
