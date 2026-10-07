<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Verify PHP upload / post limits seen by the artisan process
 * (and therefore by `composer serve` / `php -d … artisan serve`).
 */
class ShowUploadLimits extends Command
{
    protected $signature = 'upload:limits';

    protected $description = 'Print PHP upload_max_filesize, post_max_size, and memory_limit';

    public function handle(): int
    {
        $upload = (string) ini_get('upload_max_filesize');
        $post = (string) ini_get('post_max_size');
        $memory = (string) ini_get('memory_limit');

        $this->info('PHP upload limits (this process):');
        $this->line("  upload_max_filesize = {$upload}");
        $this->line("  post_max_size       = {$post}");
        $this->line("  memory_limit        = {$memory}");

        $ok = $this->isAtLeast256M($upload) && $this->isAtLeast256M($post);
        if ($ok) {
            $this->info('OK: limits are ≥ 256M. Large video uploads should not hit HTTP 413 from PHP.');
            return self::SUCCESS;
        }

        $this->warn('WARN: limits are below 256M. Restart with:');
        $this->line('  composer serve');
        $this->line('  # or');
        $this->line('  php -d upload_max_filesize=256M -d post_max_size=256M -d memory_limit=512M artisan serve --host=0.0.0.0 --port=8000');

        return self::FAILURE;
    }

    private function isAtLeast256M(string $size): bool
    {
        $size = trim($size);
        if ($size === '' || $size === '-1') {
            return $size === '-1';
        }
        $unit = strtoupper(substr($size, -1));
        $value = (float) $size;
        $bytes = match ($unit) {
            'G' => $value * 1024 * 1024 * 1024,
            'M' => $value * 1024 * 1024,
            'K' => $value * 1024,
            default => (float) $size,
        };

        return $bytes >= 256 * 1024 * 1024;
    }
}
