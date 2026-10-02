<?php

namespace App\Support;

/**
 * Dominant colour extraction from a still image, using GD only.
 *
 * WHY THIS LIVES ON THE SERVER
 * ----------------------------
 * The feed tints a fixed ambient canvas behind its floating cards with the colour of the
 * post currently in focus. That colour was first intended to be sampled on device with
 * `react-native-image-colors`, but that package turns out to be an Expo module
 * (`ImageColorsModule : Module()`) that ships no ReactPackage: React Native autolinking
 * skips it in this bare RN app, so the native call is absent at runtime and fails silently
 * into the fallback colour. It also hard-depends on a `:expo-modules-core` Gradle project
 * this app does not have.
 *
 * Sampling server-side is strictly better for this use case:
 *   - it runs once, at upload, well away from the scroll path;
 *   - it costs the client nothing, so it can never jank a fling;
 *   - iOS and Android receive the identical colour, instead of two different native results
 *     (Android returns `dominant`, iOS returns `primary` and has no `dominant` at all);
 *   - it reuses the poster JPEG the render pipeline already produced.
 *
 * The result ships as `dominant_color` and is read on the client by
 * `resolveServerAmbientAccent`.
 *
 * WHY NOT `androidx.palette` / a quantiser
 * -----------------------------------------
 * The dominant colour here is only a subtle backdrop tint behind dark UI, so the accuracy
 * of a real quantiser is not worth a native dependency. Squashing to a 24x24 grid and
 * picking the most common 3-bit-per-channel bucket is stable enough, costs a few
 * milliseconds, and needs nothing beyond the GD extension Laravel already runs with.
 */
class DominantColor
{
    /**
     * Edge of the square we squash to before counting.
     *
     * Squashing (rather than letterboxing to an aspect-preserving fit) is deliberate: we
     * want the image's overall tone, not a centre crop of it.
     */
    private const SAMPLE_EDGE = 24;

    /**
     * Bits kept per channel when bucketing: 3 bits => 8 levels per channel => 512 buckets.
     *
     * Coarse enough that anti-aliased edges and JPEG ringing land in the same bucket as the
     * colour they came from, fine enough to keep a sunset from collapsing into "orange".
     */
    private const BUCKET_BITS = 3;

    /** Samples we require before trusting a bucket, so a one-pixel artefact cannot win. */
    private const MIN_BUCKET_SAMPLES = 2;

    /** Refuse absurdly large sources: the decode is the memory spike, not the count. */
    private const MAX_SOURCE_EDGE = 8000;

    /**
     * Dominant colour of an encoded image, as `#RRGGBB`, or null when it cannot be read.
     */
    public static function fromString(string $binary): ?string
    {
        if ($binary === '' || !function_exists('imagecreatefromstring')) {
            return null;
        }

        $image = @imagecreatefromstring($binary);
        if ($image === false) {
            return null;
        }

        // No imagedestroy(): it is deprecated as of PHP 8.0 (a GdImage is freed by the
        // collector now) and this project runs PHP 8.5, where calling it emits a
        // deprecation on every sample.
        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 1 || $height < 1) {
            return null;
        }
        if ($width > self::MAX_SOURCE_EDGE || $height > self::MAX_SOURCE_EDGE) {
            return null;
        }

        return self::dominantOf($image, $width, $height);
    }

    /** Dominant colour of an image on disk, or null when the path is not a readable image. */
    public static function fromFile(string $path): ?string
    {
        if ($path === '' || !is_file($path) || !is_readable($path)) {
            return null;
        }

        $binary = @file_get_contents($path);

        return $binary === false ? null : self::fromString($binary);
    }

    /**
     * Pick the most populated colour bucket and return the mean colour inside it.
     *
     * Averaging within the winning bucket (instead of returning one arbitrary pixel from
     * it) removes the last of the quantisation step, so neighbouring buckets do not produce
     * visibly different results for the same image.
     */
    private static function dominantOf(\GdImage $image, int $width, int $height): ?string
    {
        $edge = self::SAMPLE_EDGE;
        $small = imagescale($image, $edge, $edge, IMG_BILINEAR_FIXED);
        if ($small === false) {
            return null;
        }

        $shift = 8 - self::BUCKET_BITS;
        $twoBits = 2 * self::BUCKET_BITS;

        /** @var array<int, array{0:int,1:int,2:int,3:int}> $buckets */
        $buckets = [];

        for ($y = 0; $y < $edge; $y++) {
            for ($x = 0; $x < $edge; $x++) {
                $rgb = imagecolorat($small, $x, $y);
                $red = ($rgb >> 16) & 0xFF;
                $green = ($rgb >> 8) & 0xFF;
                $blue = $rgb & 0xFF;

                $key = (($red >> $shift) << $twoBits)
                    | (($green >> $shift) << self::BUCKET_BITS)
                    | ($blue >> $shift);

                if (! isset($buckets[$key])) {
                    $buckets[$key] = [0, 0, 0, 0];
                }
                $buckets[$key][0]++;
                $buckets[$key][1] += $red;
                $buckets[$key][2] += $green;
                $buckets[$key][3] += $blue;
            }
        }

        $bestKey = null;
        $bestCount = 0;
        foreach ($buckets as $key => $bucket) {
            if ($bucket[0] > $bestCount) {
                $bestKey = $key;
                $bestCount = $bucket[0];
            }
        }

        if ($bestKey === null || $bestCount < self::MIN_BUCKET_SAMPLES) {
            return null;
        }

        $bucket = $buckets[$bestKey];
        $red = (int) round($bucket[1] / $bucket[0]);
        $green = (int) round($bucket[2] / $bucket[0]);
        $blue = (int) round($bucket[3] / $bucket[0]);

        return sprintf('#%02X%02X%02X', $red, $green, $blue);
    }

    /** True when the value is a `#RRGGBB` string this class could have produced. */
    public static function isValid(?string $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9A-F]{6}$/', $value) === 1;
    }
}