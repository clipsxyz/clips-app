<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneNotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_prune_deletes_old_read_notifications_and_keeps_unread_and_pending_requests(): void
    {
        $owner = User::factory()->create();
        $requester = User::factory()->create();
        $old = now()->subDays(40);

        $staleRead = $this->notification($owner, 'like', 'Someone', true, $old);
        $staleUnread = $this->notification($owner, 'like', 'Someone', false, $old);
        $recentRead = $this->notification($owner, 'like', 'Someone', true, now()->subDays(5));
        $pendingRequest = $this->notification($owner, 'follow_request', $requester->handle, true, $old);
        $finishedRequest = $this->notification($owner, 'follow_request', 'gone@example', true, $old);

        DB::table('user_follows')->insert([
            'follower_id' => $requester->id,
            'following_id' => $owner->id,
            'status' => 'pending',
            'created_at' => $old,
            'updated_at' => $old,
        ]);

        $this->artisan('gazetteer:prune-notifications')
            ->expectsOutputToContain('Deleted 2 read notifications older than 30 days.')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('notifications', ['id' => $staleRead]);
        $this->assertDatabaseMissing('notifications', ['id' => $finishedRequest]);
        $this->assertDatabaseHas('notifications', ['id' => $staleUnread]);
        $this->assertDatabaseHas('notifications', ['id' => $recentRead]);
        $this->assertDatabaseHas('notifications', ['id' => $pendingRequest]);
        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $requester->id,
            'following_id' => $owner->id,
            'status' => 'pending',
        ]);
    }

    private function notification(User $owner, string $type, string $fromHandle, bool $read, $createdAt): string
    {
        $notification = Notification::query()->create([
            'user_id' => $owner->id,
            'type' => $type,
            'from_handle' => $fromHandle,
            'to_handle' => $owner->handle,
            'message' => 'test',
            'read' => $read,
        ]);
        DB::table('notifications')->where('id', $notification->id)->update([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        return (string) $notification->id;
    }
}
