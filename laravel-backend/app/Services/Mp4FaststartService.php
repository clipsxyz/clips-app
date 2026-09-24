<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Move the MP4 moov atom to the front so ExoPlayer can start before the file finishes downloading.
 */
class Mp4FaststartService
{
    private const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v'];

    public function rewriteStoredUpload(string $disk, string $path): void
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (! in_array($ext, self::VIDEO_EXTENSIONS, true)) {
            return;
        }

        try {
            $driver = config("filesystems.disks.{$disk}.driver");
            if ($driver !== 'local') {
                return;
            }

            $absolute = Storage::disk($disk)->path($path);
            $this->remuxInPlace($absolute);
        } catch (\Throwable $e) {
            Log::warning('MP4 faststart skipped', [
                'disk' => $disk,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function remuxCommand(string $ffmpeg, string $input, string $output): string
    {
        return sprintf(
            '%s -y -i %s -c copy -movflags +faststart %s 2>&1',
            escapeshellarg($ffmpeg),
            escapeshellarg($input),
            escapeshellarg($output)
        );
    }

    private function remuxInPlace(string $absolute): void
    {
        if (! is_file($absolute) || filesize($absolute) < 32) {
            return;
        }

        $ffmpeg = $this->ffmpegBinary();
        if ($ffmpeg === null) {
            Log::warning('MP4 faststart skipped; ffmpeg not found', ['path' => $absolute]);

            return;
        }

        $tmp = $absolute.'.faststart.mp4';
        $cmd = self::remuxCommand($ffmpeg, $absolute, $tmp);
        $outputLines = [];
        $code = 0;
        exec($cmd, $outputLines, $code);

        if ($code !== 0 || ! is_file($tmp) || filesize($tmp) < 32) {
            if (is_file($tmp)) {
                @unlink($tmp);
            }
            Log::warning('MP4 faststart remux failed', [
                'path' => $absolute,
                'return_code' => $code,
                'output' => implode("\n", array_slice($outputLines, 0, 20)),
            ]);

            return;
        }

        if (! @rename($tmp, $absolute)) {
            @unlink($tmp);
            Log::warning('MP4 faststart could not replace original', ['path' => $absolute]);
        }
    }

    private function ffmpegBinary(): ?string
    {
        foreach (['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'] as $bin) {
            if ($bin === 'ffmpeg') {
                $found = trim((string) shell_exec('command -v ffmpeg 2>/dev/null'));
                if ($found !== '') {
                    return $found;
                }
                continue;
            }
            if (is_file($bin) && is_executable($bin)) {
                return $bin;
            }
        }

        return null;
    }
}
