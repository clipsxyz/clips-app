<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneStaleFcmTokensTest extends TestCase
{
    use RefreshDatabase;

    public function test_prune_removes_tokens_for_inactive_users_only(): void
    {
        $active = User::factory()->create();
        $inactive = User::factory()->create();
        $neverActive = User::factory()->create();
        $recentAccount = User::factory()->create();

        DB::table('users')->where('id', $active->id)->update([
            'last_active_at' => now()->subDay(),
        ]);
        DB::table('users')->where('id', $inactive->id)->update([
            'last_active_at' => now()->subDays(120),
            'updated_at' => now()->subDays(120),
        ]);
        DB::table('users')->where('id', $neverActive->id)->update([
            'last_active_at' => null,
            'updated_at' => now()->subDays(100),
        ]);
        DB::table('users')->where('id', $recentAccount->id)->update([
            'last_active_at' => null,
            'updated_at' => now()->subDays(2),
        ]);

        foreach ([$active, $inactive, $neverActive, $recentAccount] as $user) {
            DB::table('fcm_tokens')->insert([
                'user_id' => (string) $user->id,
                'user_handle' => $user->handle,
                'token' => 'token-'.$user->id,
                'created_at' => now()->subDays(200),
                'updated_at' => now()->subDays(200),
            ]);
        }

        $this->artisan('fcm:prune', ['--days' => 90])
            ->expectsOutputToContain('Cleared 2 stale FCM tokens older than 90 days.')
            ->assertExitCode(0);

        $this->assertDatabaseHas('fcm_tokens', ['token' => 'token-'.$active->id]);
        $this->assertDatabaseHas('fcm_tokens', ['token' => 'token-'.$recentAccount->id]);
        $this->assertDatabaseMissing('fcm_tokens', ['token' => 'token-'.$inactive->id]);
        $this->assertDatabaseMissing('fcm_tokens', ['token' => 'token-'.$neverActive->id]);
    }
}
