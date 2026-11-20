<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneNotifications extends Command
{
    protected $signature = 'gazetteer:prune-notifications {--days=30 : Delete read notifications older than this many days}';

    protected $description = 'Delete read notifications older than 30 days. Unread notifications and pending follow requests stay.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $days = 30;
        }

        $cutoff = now()->subDays($days);

        $deleted = DB::table('notifications')
            ->where('read', true)
            ->where('created_at', '<', $cutoff)
            ->where(function ($query) {
                $query->where('type', '!=', 'follow_request')
                    ->orWhereNotExists(function ($follow) {
                        $follow->select(DB::raw(1))
                            ->from('user_follows')
                            ->join('users as requesters', 'requesters.id', '=', 'user_follows.follower_id')
                            ->whereColumn('user_follows.following_id', 'notifications.user_id')
                            ->where('user_follows.status', 'pending')
                            ->whereRaw('LOWER(requesters.handle) = LOWER(notifications.from_handle)');
                    });
            })
            ->delete();

        $this->info('Deleted '.$deleted.' read notifications older than '.$days.' days.');

        return self::SUCCESS;
    }
}
