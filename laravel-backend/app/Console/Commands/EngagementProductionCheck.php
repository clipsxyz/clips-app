<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class EngagementProductionCheck extends Command
{
    protected $signature = 'engagement:production-check';

    protected $description = 'Verify migrations, mail config, and scheduler are ready for inactive digest emails';

    public function handle(): int
    {
        $ok = true;
        $isProd = app()->environment('production');

        $this->info('Engagement email production check');
        $this->newLine();

        if (! Schema::hasColumn('users', 'last_active_at') || ! Schema::hasColumn('users', 'email_digest_enabled')) {
            $this->error('Missing users columns. Run: php artisan migrate --force');
            $ok = false;
        } else {
            $this->line('  <fg=green>✓</> Database columns present');
        }

        if (! Schema::hasTable('engagement_email_logs')) {
            $this->error('Missing engagement_email_logs table. Run: php artisan migrate --force');
            $ok = false;
        } else {
            $this->line('  <fg=green>✓</> engagement_email_logs table present');
        }

        $mailer = (string) config('mail.default', 'log');
        if ($isProd && $mailer === 'log') {
            $this->error('MAIL_MAILER=log in production — set smtp, postmark, or ses in .env');
            $ok = false;
        } elseif ($mailer === 'log') {
            $this->warn('  MAIL_MAILER=log (OK for local; use smtp/postmark/ses in production)');
        } else {
            $this->line("  <fg=green>✓</> Mail driver: {$mailer}");
        }

        $from = (string) config('mail.from.address', '');
        if ($from === '' || str_contains($from, 'example.com')) {
            $this->warn('  Set MAIL_FROM_ADDRESS to a verified sender domain');
            if ($isProd) {
                $ok = false;
            }
        } else {
            $this->line("  <fg=green>✓</> From: {$from}");
        }

        $frontend = rtrim((string) env('FRONTEND_APP_URL', ''), '/');
        if ($frontend === '' || str_contains($frontend, 'localhost')) {
            $this->warn('  Set FRONTEND_APP_URL to your live app URL (digest button links there)');
            if ($isProd) {
                $ok = false;
            }
        } else {
            $this->line("  <fg=green>✓</> FRONTEND_APP_URL: {$frontend}");
        }

        try {
            $scheduled = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
                ->contains(fn ($e) => str_contains($e->command ?? '', 'engagement:send-inactive-digests'));
            if ($scheduled) {
                $this->line('  <fg=green>✓</> Scheduled: engagement:send-inactive-digests (daily 09:00)');
            } else {
                $this->error('Digest command not in app schedule — check app/Console/Kernel.php');
                $ok = false;
            }
        } catch (\Throwable) {
            $this->warn('  Could not read schedule (non-fatal)');
        }

        $this->newLine();
        $this->line('Cron on the server (required in production):');
        $this->line('  * * * * * cd ' . base_path() . ' && php artisan schedule:run >> /dev/null 2>&1');
        $this->newLine();

        if (! $ok) {
            $this->error('Fix the issues above before relying on digest emails in production.');

            return self::FAILURE;
        }

        $this->info($isProd ? 'Production check passed.' : 'Local check passed (re-run on server with APP_ENV=production).');

        return self::SUCCESS;
    }
}
