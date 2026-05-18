<?php

namespace App\Console\Commands;

use App\Mail\InactiveDigestMail;
use App\Models\User;
use App\Services\InactiveDigestService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendInactiveDigestEmails extends Command
{
    protected $signature = 'engagement:send-inactive-digests
                            {--dry-run : Build digests but do not send email}
                            {--email= : Only process one user by email (for testing)}
                            {--force : Ignore inactive-day threshold (still respects cooldown unless --email is set)}';

    protected $description = 'Send Instagram-style inactive digest emails to users who have missed local feed activity';

    public function handle(InactiveDigestService $digestService): int
    {
        $inactiveDays = (int) config('engagement.inactive_days', 3);
        $cutoff = now()->subDays($inactiveDays);
        $dryRun = (bool) $this->option('dry-run');
        $onlyEmail = $this->option('email');
        $force = (bool) $this->option('force');

        $query = User::query()
            ->where('email_digest_enabled', true)
            ->whereNotNull('email');

        if ($onlyEmail) {
            $query->where('email', $onlyEmail);
        } elseif (!$force) {
            $query->where(function ($q) use ($cutoff) {
                $q->whereNull('last_active_at')
                    ->orWhere('last_active_at', '<', $cutoff);
            });
        }

        $users = $query->get();
        if ($users->isEmpty()) {
            $this->info('No users matched for inactive digest.');
            return self::SUCCESS;
        }

        $sent = 0;
        $skipped = 0;

        foreach ($users as $user) {
            if (!$onlyEmail && $digestService->recentlySentDigest($user)) {
                $skipped++;
                continue;
            }

            $digest = $digestService->buildDigestForUser($user);
            if (!$digest) {
                $skipped++;
                continue;
            }

            $openUrl = rtrim((string) env('FRONTEND_APP_URL', 'http://localhost:5173'), '/') . '/feed';

            if ($dryRun) {
                $this->line("[dry-run] Would email {$user->email}: " . json_encode($digest));
                $sent++;
                continue;
            }

            Mail::to($user->email)->send(new InactiveDigestMail($user, $digest, $openUrl));
            $digestService->logSent($user, $digest);
            $this->info("Sent inactive digest to {$user->email}");
            $sent++;
        }

        $this->info("Done. sent={$sent} skipped={$skipped} dry_run=" . ($dryRun ? 'yes' : 'no'));

        return self::SUCCESS;
    }
}
