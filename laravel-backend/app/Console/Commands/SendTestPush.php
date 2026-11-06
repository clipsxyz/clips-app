<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\ApnsConfig;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;
use Throwable;

class SendTestPush extends Command
{
    protected $signature = 'push:test {user_id} {--target=feed : Target route (feed, post, story)} {--id= : ID of the post or story} {--badge=1 : APNs badge count}';

    protected $description = 'Send a test FCM push with a deep-link routing payload for the feed, a post, or a story';

    public function handle(Messaging $messaging): int
    {
        $user = User::findOrFail($this->argument('user_id'));

        if (! is_string($user->fcm_token) || $user->fcm_token === '') {
            $this->error('This user has no FCM token.');

            return self::FAILURE;
        }

        $target = (string) ($this->option('target') ?: 'feed');
        $id = $this->option('id');
        $dataPayload = [
            'type' => 'deep_link',
            'route' => $target,
        ];

        if ($target === 'post' && $id !== null && $id !== '') {
            $dataPayload['post_id'] = (string) $id;
        }

        if ($target === 'story' && $id !== null && $id !== '') {
            $dataPayload['story_id'] = (string) $id;
        }

        $body = match ($target) {
            'post' => 'Tap to view this post update!',
            'story' => 'Tap to view this story!',
            default => 'Tap to open your Gazetteer feed!',
        };

        $badge = (int) $this->option('badge');
        $apnsConfig = ApnsConfig::fromArray([
            'payload' => [
                'aps' => [
                    'sound' => 'default',
                    'badge' => $badge,
                    'content-available' => 1,
                ],
            ],
        ]);

        $message = CloudMessage::withTarget('token', $user->fcm_token)
            ->withNotification(Notification::create('Gazetteer Alert 🚀', $body))
            ->withData($dataPayload)
            ->withApnsConfig($apnsConfig);

        try {
            $messaging->send($message);
        } catch (Throwable $e) {
            $this->error('Failed to send test push: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('Test push sent to '.$user->id.' (route: '.$target.').');

        return self::SUCCESS;
    }
}
