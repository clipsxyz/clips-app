<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

/**
 * Ensures Ava@galway follows Barry so that when Barry@Cork follows Ava back,
 * they are mutual and the DM icon shows on the feed card.
 * Run: php artisan db:seed --class=EnsureAvaFollowsBarrySeeder
 */
class EnsureAvaFollowsBarrySeeder extends Seeder
{
    public function run(): void
    {
        $barry = User::whereRaw('LOWER(handle) LIKE ?', ['%barry%'])->first();
        $ava = User::whereRaw('LOWER(handle) = ?', ['ava@galway'])->first();

        if (!$barry) {
            $this->command->warn('User Barry@Cork (or similar) not found. Create that user first (e.g. register in app).');
            return;
        }
        if (!$ava) {
            $this->command->warn('User Ava@galway not found. Run full GazetteerSeeder first.');
            return;
        }

        $alreadyFollows = $barry->followers()->where('follower_id', $ava->id)->exists();
        if ($alreadyFollows) {
            $this->command->info('Ava@galway already follows Barry. Nothing to do.');
            return;
        }

        $barry->followers()->attach($ava->id, ['status' => 'accepted']);
        $ava->increment('following_count');
        $barry->increment('followers_count');
        $this->command->info("Ava ({$ava->handle}) now follows Barry ({$barry->handle}). As Barry@Cork, follow Ava@galway back to see the DM icon (mutual follow).");
    }
}
