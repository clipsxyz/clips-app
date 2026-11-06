<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Mockery;
use Tests\TestCase;

class SendTestPushTest extends TestCase
{
    use RefreshDatabase;

    public function test_push_test_errors_when_user_has_no_token(): void
    {
        $user = User::factory()->create();
        $this->app->instance(Messaging::class, Mockery::mock(Messaging::class));

        $this->artisan('push:test', ['user_id' => $user->id])
            ->expectsOutputToContain('no FCM token')
            ->assertExitCode(1);
    }

    public function test_push_test_sends_to_the_users_device_token(): void
    {
        $user = User::factory()->create();
        DB::table('fcm_tokens')->insert([
            'user_id' => (string) $user->id,
            'user_handle' => $user->handle,
            'token' => 'device-token-1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('send')
            ->once()
            ->with(Mockery::on(function ($message) {
                if (! $message instanceof CloudMessage) {
                    return false;
                }
                $payload = $message->jsonSerialize();

                return ($payload['token'] ?? null) === 'device-token-1'
                    && ($payload['notification']['title'] ?? null) === 'Gazetteer Alert 🚀'
                    && ($payload['notification']['body'] ?? null) === 'Tap to open your Gazetteer feed!'
                    && ($payload['data']['type'] ?? null) === 'deep_link'
                    && ($payload['data']['route'] ?? null) === 'feed'
                    && ! isset($payload['data']['post_id'])
                    && ! isset($payload['data']['story_id'])
                    && ($payload['apns']['payload']['aps']['sound'] ?? null) === 'default'
                    && ($payload['apns']['payload']['aps']['badge'] ?? null) === 1
                    && ($payload['apns']['payload']['aps']['content-available'] ?? null) === 1;
            }))
            ->andReturn(['name' => 'projects/test/messages/1']);
        $this->app->instance(Messaging::class, $messaging);

        $this->artisan('push:test', ['user_id' => $user->id])
            ->expectsOutputToContain('route: feed')
            ->assertExitCode(0);
    }

    public function test_push_test_includes_post_or_story_id(): void
    {
        $user = User::factory()->create();
        DB::table('fcm_tokens')->insert([
            'user_id' => (string) $user->id,
            'user_handle' => $user->handle,
            'token' => 'device-token-2',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('send')
            ->once()
            ->with(Mockery::on(function ($message) {
                if (! $message instanceof CloudMessage) {
                    return false;
                }
                $payload = $message->jsonSerialize();

                return ($payload['notification']['body'] ?? null) === 'Tap to view this post update!'
                    && ($payload['data']['type'] ?? null) === 'deep_link'
                    && ($payload['data']['route'] ?? null) === 'post'
                    && ($payload['data']['post_id'] ?? null) === 'post-42'
                    && ($payload['apns']['payload']['aps']['badge'] ?? null) === 4
                    && ($payload['apns']['payload']['aps']['sound'] ?? null) === 'default';
            }))
            ->andReturn(['name' => 'projects/test/messages/2']);
        $this->app->instance(Messaging::class, $messaging);

        $this->artisan('push:test', [
            'user_id' => $user->id,
            '--target' => 'post',
            '--id' => 'post-42',
            '--badge' => 4,
        ])->expectsOutputToContain('route: post')->assertExitCode(0);
    }
}
