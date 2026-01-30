<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Makes Ava@galway follow Barry so you (Barry@Cork) can test the mutual-follow DM icon.
 *
 * Run: php artisan ava-follows-barry
 */
class EnsureAvaFollowsBarry extends Command
{
    protected $signature = 'ava-follows-barry';

    protected $description = 'Make Ava@galway follow Barry so mutual-follow DM icon can be tested';

    public function handle(): int
    {
        $barry = User::whereRaw('LOWER(handle) LIKE ?', ['%barry%'])->first();
        $ava = User::whereRaw('LOWER(handle) = ?', ['ava@galway'])->first();

        if (!$barry) {
            $this->error('No user with "barry" in handle found. Create barry@cork (or similar) first.');
            $this->line('Existing handles: ' . User::pluck('handle')->implode(', '));
            return 1;
        }

        if (!$ava) {
            $this->error('Ava@galway not found. Run db:seed (GazetteerSeeder) or hit /api/dev/ava-follows-barry to create her.');
            $this->line('Existing handles: ' . User::pluck('handle')->implode(', '));
            return 1;
        }

        if ($barry->id === $ava->id) {
            $this->error('Barry and Ava are the same user (handle contains both?). Use two different accounts.');
            return 1;
        }

        $alreadyFollows = $barry->followers()->where('follower_id', $ava->id)->exists();
        if ($alreadyFollows) {
            $this->info("Ava ({$ava->handle}) already follows Barry ({$barry->handle}). You're good – refresh the app feed to see the DM icon.");
            return 0;
        }

        $barry->followers()->attach($ava->id, ['status' => 'accepted']);
        $ava->increment('following_count');
        $barry->increment('followers_count');

        $this->info("Done. Ava ({$ava->handle}) now follows Barry ({$barry->handle}).");
        $this->line('As Barry: refresh the feed, then follow Ava if you haven’t – you should see the DM icon (mutual follow).');
        return 0;
    }
}
