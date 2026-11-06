<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneStaleFcmTokens extends Command
{
    protected $signature = 'fcm:prune {--days=90 : Inactivity threshold in days}';

    protected $description = 'Prune stale or inactive FCM tokens from user records to prevent dead-letter notifications.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $days = 90;
        }

        $cutoff = now()->subDays($days);

        // Device tokens live in fcm_tokens. Clearing a row is what makes $user->fcm_token null.
        $userIds = DB::table('users')
            ->where(function ($query) use ($cutoff) {
                $query->where('last_active_at', '<', $cutoff)
                    ->orWhere(function ($query) use ($cutoff) {
                        $query->whereNull('last_active_at')
                            ->where('updated_at', '<', $cutoff);
                    });
            })
            ->pluck('id');

        $cleared = 0;
        foreach ($userIds->chunk(500) as $ids) {
            $cleared += DB::table('fcm_tokens')
                ->whereIn('user_id', $ids->all())
                ->whereNotNull('token')
                ->where('token', '!=', '')
                ->delete();
        }

        $this->info('Cleared '.$cleared.' stale FCM tokens older than '.$days.' days.');

        return self::SUCCESS;
    }
}
