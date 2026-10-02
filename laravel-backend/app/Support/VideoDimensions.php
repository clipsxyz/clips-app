<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * Reads intrinsic pixel dimensions out of media container metadata.
 *
 * WHY NOT FFMPEG OR GETID3
 * ------------------------
 * Neither is available in this deployment:
 *   - `ext-ffmpeg` is not installed (only `exif` and `gd` are).
 *   - There is no `ffprobe`/`ffmpeg` binary on the host PATH.
 *   - `getid3/getid3` is not in composer.json or vendor/.
 *
 * Adding a composer package would also mean the extractor only works on hosts that can
 * reach packagist, and this app's dev environment has not been able to install new
 * packages. So this is a hand-rolled ISO-BMFF box walker.
 *
 * SCOPE, HONESTLY STATED
 * ----------------------
 * This handles the container metadata every MP4 produced by a modern encoder carries:
 *
 *   ftyp / moov
 *     trak                       (pick the video trak, identified via `hdlr` type 'vide')
 *       tkhd                     display width/height, 16.16 fixed point
 *       mdia > minf > stbl > stsd > <codec>  coded width/height, uint16
 *
 * The `tkhd` matrix is honoured, so a portrait phone recording (matrix [0,1,-1,0,..],
 * a 90-degree rotation) is reported portrait. That matters because the single most
 * common "why is my 9:16 clip showing as 16:9" bug is ignoring the rotation matrix.
 *
 * NOT handled, and returning null rather than a guess:
 *   - WebM/Matroska, MOV with non-ISO boxes, AVI, MKV (no `ftyp`/`moov`).
 *   - `moov` at the very end of a file larger than the read window (progressive
 *     `moov`-after-mdat is legal). The window is 4 MB which covers essentially every
 *     social-media upload, but a pathological file will return null.
 *   - Corrupt or truncated headers.
 *
 * A null result is a legitimate, useful answer: the client falls back to measuring
 * `naturalSize` at runtime. It is never worse than the fixed-token guess this replaces.
 */
final class VideoDimensions
{
    /**
     * Bytes read from the head of the file when hunting for `moov`.
     *
     * `moov` precedes `mdat` in "faststart" MP4s, which every current encoder emits
     * because it lets a player start without downloading the whole file. 4 MB is a
     * generous ceiling for the box tree.
     */
    private const HEADER_WINDOW = 4 * 1024 * 1024;

    /** Hard ceiling on a plausible dimension, mirroring the client-side guard. */
    private const MAX_TRUSTED_DIMENSION = 8192;

    /**
     * Bytes from the start of the tkhd PAYLOAD to the `width` field.
     *
     *   version(1)+flags(3) = 4
     *   created modified track_ID reserved duration = 20   (version 0)
     *   reserved = 8
     *   layer alternate_group volume reserved = 8
     *   display matrix = 36
     *   -> width, then height
     *
     * 4 + 20 + 8 + 8 + 36 = 76. This is the spec position and it is also simply the last
     * 8 bytes of a 92-byte version 0 tkhd, which is a useful independent cross-check.
     * Version 1 tkhd adds 12 bytes of 64-bit timing fields (88 instead of 76).
     */
    private const TKHD_WIDTH_OFFSET = 4 + 20 + 8 + 8 + 36; // 76

    /**
     * Bytes from the tkhd payload start to the 36-byte display matrix, i.e. immediately
     * before {@see self::TKHD_WIDTH_OFFSET}. Distinct field from the width offset -- using
     * one constant for both made the rotation check read the width/height pair and never
     * fire.
     */
    private const TKHD_MATRIX_OFFSET = 4 + 20 + 8 + 8; // 40

    /** Box types we descend into. */
    private const CONTAINER_BOXES = ['moov', 'trak', 'mdia', 'minf', 'stbl'];

    /**
     * Return ['width' => int, 'height' => int] for a video file, or null.
     *
     * @param  string|UploadedFile  $file  absolute path or an uploaded file
     * @return array{width: int, height: int}|null
     */
    public static function fromFile($file): ?array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : (string) $file;

        if ($path === '' || ! is_readable($path) || ! is_file($path)) {
            return null;
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            return null;
        }

        try {
            $size = filesize($path);

            if ($size === false || $size < 8) {
                return null;
            }

            $window = min(self::HEADER_WINDOW, $size);
            $bytes = fread($handle, $window);

            if ($bytes === false || strlen($bytes) < 8) {
                return null;
            }

            return self::fromBytes($bytes);
        } finally {
            fclose($handle);
        }
    }

    /**
     * Same as {@see fromFile()} but for bytes already in memory (tests, fixtures).
     *
     * @return array{width: int, height: int}|null
     */
    public static function fromBytes(string $bytes): ?array
    {
        $moov = self::findBox($bytes, 'moov', 0, strlen($bytes));

        if ($moov === null) {
            return null;
        }

        [$moovStart, $moovEnd] = $moov;

        foreach (self::childBoxes($bytes, $moovStart, $moovEnd) as [$type, $start, $end]) {
            if ($type !== 'trak') {
                continue;
            }

            $dimensions = self::dimensionsFromTrak($bytes, $start, $end);

            if ($dimensions !== null) {
                return $dimensions;
            }
        }

        return null;
    }

    /**
     * Pull width/height from one `trak`, or null if it is not the video track.
     *
     * NOTE: childBoxes() yields each box's PAYLOAD start, not its box start. Adding the
     * 8-byte box header again here overshot by 8 bytes and made every file read as 0x0.
     *
     * @return array{width: int, height: int}|null
     */
    private static function dimensionsFromTrak(string $bytes, int $start, int $end): ?array
    {
        $boxes = self::childBoxes($bytes, $start, $end);

        $tkhdPayload = null;
        $isVideo = false;

        foreach ($boxes as [$type, $payloadStart, $boxEnd]) {
            if ($type === 'tkhd') {
                $tkhdPayload = $payloadStart;
            } elseif ($type === 'mdia' && self::isVideoHandler($bytes, $payloadStart, $boxEnd)) {
                $isVideo = true;
            }
        }

        // Skip audio and other non-visual tracks. Returning an audio track's dimensions
        // would be garbage, and an audio trak legitimately carries a 0x0 tkhd.
        if ($tkhdPayload === null || ! $isVideo) {
            return null;
        }

        $offset = $tkhdPayload + self::TKHD_WIDTH_OFFSET;

        if ($offset + 8 > strlen($bytes)) {
            return null;
        }

        $unpacked = unpack('Nw/Nh', substr($bytes, $offset, 8));

        if ($unpacked === false) {
            return null;
        }

        // 16.16 fixed point: the integer part is the upper 16 bits.
        $width = (int) round($unpacked['w'] / 65536);
        $height = (int) round($unpacked['h'] / 65536);

        if (! self::isSane($width) || ! self::isSane($height)) {
            return null;
        }

        // Honour the 90/270-degree rotation in the display matrix. A portrait phone
        // recording stores the pre-rotation size with a quarter-turn matrix; reporting it
        // unrotated is the classic cause of a vertical clip rendering as a landscape box.
        if (self::displayMatrixIsQuarterTurned($bytes, $tkhdPayload)) {
            [$width, $height] = [$height, $width];
        }

        return ['width' => $width, 'height' => $height];
    }

    /**
     * True when `mdia > hdlr` declares handler_type 'vide'.
     */
    private static function isVideoHandler(string $bytes, int $start, int $end): bool
    {
        foreach (self::childBoxes($bytes, $start, $end) as [$type, $payloadStart, $boxEnd]) {
            if ($type !== 'hdlr') {
                continue;
            }

            // hdlr payload: version+flags(4), pre_defined(4), handler_type(4).
            // $payloadStart is already past the box header, so only the two payload
            // fields offset it -- adding a third 8 landed on the wrong field and made
            // every track look like it was not video.
            $at = $payloadStart + 8;

            if ($at + 4 <= strlen($bytes)) {
                return substr($bytes, $at, 4) === 'vide';
            }
        }

        return false;
    }

    /**
     * Read the 3x2 display matrix and report whether it rotates by a quarter turn.
     *
     * a=0, b=1 (second row) is the canonical 90-degree rotation.
     */
    private static function displayMatrixIsQuarterTurned(string $bytes, int $payloadStart): bool
    {
        // Same table as above; the matrix sits immediately before width/height.
        $matrixAt = $payloadStart + self::TKHD_MATRIX_OFFSET;

        if ($matrixAt + 36 > strlen($bytes)) {
            return false;
        }

        $m = unpack('Na/Nb/Nu/Nv/Nw/Nx/Ny/Nz', substr($bytes, $matrixAt, 36));

        if ($m === false) {
            return false;
        }

        // 16.16 fixed point: 0x00010000 == 1.0.
        $a = $m['a'] / 65536;
        $b = $m['b'] / 65536;

        // The 3x2 rotation matrix [a b u v] means, for the four upright orientations:
        //     0 degrees: a=1  b=0
        //    90 degrees: a=0  b=1     (270 degrees: a=0, b=-1)
        //   180 degrees: a=-1 b=0
        // A quarter turn is therefore exactly "a is zero and |b| is one". Checking the
        // identity case separately keeps a 180-degree clip from being transposed, since
        // transposing it would be wrong (it is upside down, not sideways).
        return abs($a) < 0.01 && abs(abs($b) - 1) < 0.01;
    }

    /**
     * Yield [type, payloadStart, payloadEnd] for each direct child box.
     *
     * @return array<int, array{0: string, 1: int, 2: int}>
     */
    private static function childBoxes(string $bytes, int $start, int $end): array
    {
        $out = [];
        $offset = $start;
        $length = strlen($bytes);

        while ($offset + 8 <= $end && $offset + 8 <= $length) {
            $header = unpack('Nsize', substr($bytes, $offset, 4));

            if ($header === false) {
                break;
            }

            $size = $header['size'];
            $type = substr($bytes, $offset + 4, 4);
            $payloadStart = $offset + 8;

            if ($size === 1) {
                // 64-bit extended size.
                $wide = unpack('Jbig', substr($bytes, $payloadStart, 8));

                if ($wide === false) {
                    break;
                }

                $size = (int) $wide['big'];
                $payloadStart += 8;
            } elseif ($size === 0) {
                // Box runs to the end of its container.
                $size = $end - $offset;
            }

            if ($size < 8 || $offset + $size > $length) {
                break;
            }

            $out[] = [$type, $payloadStart, $offset + $size];
            $offset += $size;
        }

        return $out;
    }

    /**
     * Depth-limited search for the first box of the given type.
     *
     * @return array{0: int, 1: int}|null [payloadStart, end]
     */
    private static function findBox(string $bytes, string $type, int $start, int $end, int $depth = 0): ?array
    {
        if ($depth > 8) {
            return null;
        }

        foreach (self::childBoxes($bytes, $start, $end) as [$boxType, $payloadStart, $boxEnd]) {
            if ($boxType === $type) {
                return [$payloadStart, $boxEnd];
            }

            if (in_array($boxType, self::CONTAINER_BOXES, true)) {
                $found = self::findBox($bytes, $type, $payloadStart, $boxEnd, $depth + 1);

                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }

    /**
     * A dimension must be positive, sane, and inside the trusted ceiling.
     */
    private static function isSane(int $value): bool
    {
        return $value > 0 && $value <= self::MAX_TRUSTED_DIMENSION;
    }

    /**
     * Still images: prefer EXIF (which survives rotation), then GD.
     *
     * @return array{width: int, height: int}|null
     */
    public static function fromImage($file): ?array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : (string) $file;

        if ($path === '' || ! is_readable($path) || ! is_file($path)) {
            return null;
        }

        $info = @getimagesize($path);

        if (is_array($info) && isset($info[0], $info[1]) && self::isSane((int) $info[0]) && self::isSane((int) $info[1])) {
            // getimagesize reports the stored dimensions, not the EXIF-rotated view.
            // For a JPEG, Orientation 5-8 means the displayed image is transposed.
            $exif = @exif_read_data($path);

            if (is_array($exif) && isset($exif['Orientation']) && in_array((int) $exif['Orientation'], [5, 6, 7, 8], true)) {
                return ['width' => (int) $info[1], 'height' => (int) $info[0]];
            }

            return ['width' => (int) $info[0], 'height' => (int) $info[1]];
        }

        return null;
    }

    /**
     * Dispatch on file extension / mime family.
     *
     * @return array{width: int, height: int}|null
     */
    public static function inspect($file): ?array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : (string) $file;
        $extension = strtolower(pathinfo((string) $path, PATHINFO_EXTENSION));

        return match ($extension) {
            'mp4', 'm4v', 'mov' => self::fromFile($file),
            'jpg', 'jpeg', 'png', 'gif', 'webp' => self::fromImage($file),
            // webm/mkv/avi return null by design -- see the class docblock.
            default => null,
        };
    }

    /**
     * Map a stored media URL to a readable local file under the public disk, or null.
     *
     * This NEVER performs a network request. It takes the URL's path component and resolves
     * it against public_path(), which is why it is safe to point at an absolute URL such as
     * http://localhost:8000/storage/uploads/x.mp4 -- the host is discarded and only the local
     * path is touched. That is the behaviour a backfill needs, since it must read files this
     * app uploaded itself.
     *
     * Two guards make the discarded host harmless:
     *   1. realpath() containment, so /storage/../../.env cannot escape the media root.
     *   2. Only /storage/** paths are accepted at all.
     *
     * Deliberately separate from PostController::localPathForMediaUrl(), which additionally
     * rejects every http(s) URL outright to keep post creation from touching the filesystem
     * based on client-supplied input at all. The backfill reads only rows already in our own
     * database, so the looser rule is appropriate there.
     */
    public static function localPathForUrl(?string $url): ?string
    {
        if ($url === null || trim($url) === '') {
            return null;
        }

        $relative = parse_url($url, PHP_URL_PATH);
        $relative = $relative === null || $relative === false ? $url : $relative;
        $relative = ltrim((string) $relative, '/');

        if (! str_starts_with($relative, 'storage/')) {
            return null;
        }

        $root = realpath(storage_path('app/public'));
        $candidate = realpath(public_path($relative));

        if ($root === false || $candidate === false) {
            return null;
        }

        if (! str_starts_with($candidate, $root.DIRECTORY_SEPARATOR)) {
            return null;
        }

        return is_file($candidate) ? $candidate : null;
    }
}
