<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\MessageTarget;
use Kreait\Firebase\Messaging\MulticastSendReport;
use Kreait\Firebase\Messaging\SendReport;
use Mockery;
use Tests\TestCase;

class SendBroadcastPushTest extends TestCase
{
    use RefreshDatabase;

    public function test_broadcast_sends_in_batches_and_purges_unregistered_tokens(): void
    {
        $kept = User::factory()->create();
        $stale = User::factory()->create();
        DB::table('fcm_tokens')->insert([
            [
                'user_id' => (string) $kept->id,
                'user_handle' => $kept->handle,
                'token' => 'good-token',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => (string) $stale->id,
                'user_handle' => $stale->handle,
                'token' => 'dead-token',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $report = MulticastSendReport::withItems([
            SendReport::success(MessageTarget::with(MessageTarget::TOKEN, 'good-token'), ['name' => 'ok']),
            SendReport::failure(
                MessageTarget::with(MessageTarget::TOKEN, 'dead-token'),
                new NotFound('Requested entity was not found.'),
            ),
        ]);

        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('sendMulticast')
            ->once()
            ->with(Mockery::on(function ($message) {
                if (! $message instanceof CloudMessage) {
                    return false;
                }
                $payload = $message->jsonSerialize();

                return ($payload['notification']['title'] ?? null) === 'Hello'
                    && ($payload['notification']['body'] ?? null) === 'A new post is live'
                    && ($payload['data']['type'] ?? null) === 'broadcast'
                    && ($payload['data']['route'] ?? null) === 'post'
                    && ($payload['data']['post_id'] ?? null) === 'post-7'
                    && ($payload['apns']['payload']['aps']['sound'] ?? null) === 'default'
                    && ($payload['apns']['payload']['aps']['badge'] ?? null) === 1
                    && ($payload['apns']['payload']['aps']['content-available'] ?? null) === 1;
            }), Mockery::on(function ($tokens) {
                $tokens = array_values($tokens);
                sort($tokens);

                return $tokens === ['dead-token', 'good-token'];
            }))
            ->andReturn($report);
        $this->app->instance(Messaging::class, $messaging);

        $this->artisan('push:broadcast', [
            '--title' => 'Hello',
            '--body' => 'A new post is live',
            '--target' => 'post',
            '--id' => 'post-7',
        ])
            ->expectsOutputToContain('Successful sends: 1')
            ->expectsOutputToContain('Failed sends: 1')
            ->expectsOutputToContain('Purged tokens: 1')
            ->assertExitCode(0);

        $this->assertDatabaseHas('fcm_tokens', ['token' => 'good-token']);
        $this->assertDatabaseMissing('fcm_tokens', ['token' => 'dead-token']);
    }

    public function test_dry_run_reports_recipients_without_sending(): void
    {
        $user = User::factory()->create();
        DB::table('fcm_tokens')->insert([
            'user_id' => (string) $user->id,
            'user_handle' => $user->handle,
            'token' => 'preview-token',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldNotReceive('sendMulticast');
        $this->app->instance(Messaging::class, $messaging);

        $this->artisan('push:broadcast', [
            '--title' => 'Hello',
            '--body' => 'Preview only',
            '--target' => 'story',
            '--id' => 'story-3',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('Dry run: no messages will be sent.')
            ->expectsOutputToContain('Recipients: 1')
            ->expectsOutputToContain('Target route: story')
            ->expectsOutputToContain('Content ID: story-3')
            ->expectsOutputToContain('Title: Hello')
            ->expectsOutputToContain('Body: Preview only')
            ->assertExitCode(0);

        $this->assertDatabaseHas('fcm_tokens', ['token' => 'preview-token']);
    }
}
