<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Exception\Messaging\InvalidArgument;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Messaging\ApnsConfig;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\MulticastSendReport;
use Kreait\Firebase\Messaging\Notification;
use Throwable;

class SendBroadcastPush extends Command
{
    protected $signature = 'push:broadcast {--title= : Notification title} {--body= : Notification body text} {--target=feed : Target route} {--id= : Content ID} {--chunk=500 : Batch size per send} {--dry-run : Simulate broadcast without sending messages to Firebase}';

    protected $description = 'Send broadcast FCM push notifications to multiple registered user devices in batches, with an optional dry run.';

    public function handle(Messaging $messaging): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $title = trim((string) $this->option('title'));
        $body = trim((string) $this->option('body'));
        if ($title === '' || $body === '') {
            $this->error('Both --title and --body are required.');

            return self::FAILURE;
        }

        $target = (string) ($this->option('target') ?: 'feed');
        $id = $this->option('id');
        $tokens = $this->registeredTokens();

        if ($tokens === []) {
            $this->warn('No registered device tokens to notify.');

            return self::SUCCESS;
        }

        if ($dryRun) {
            $contentId = $id !== null && $id !== '' ? (string) $id : '(none)';
            $this->info('Dry run: no messages will be sent.');
            $this->info('Recipients: '.count($tokens));
            $this->info('Target route: '.$target);
            $this->info('Content ID: '.$contentId);
            $this->info('Title: '.$title);
            $this->info('Body: '.$body);

            return self::SUCCESS;
        }
        $chunkSize = (int) $this->option('chunk');
        if ($chunkSize < 1) {
            $chunkSize = 500;
        }
        $chunkSize = min($chunkSize, 500);

        $dataPayload = [
            'type' => 'broadcast',
            'route' => $target,
        ];
        if ($target === 'post' && $id !== null && $id !== '') {
            $dataPayload['post_id'] = (string) $id;
        }
        if ($target === 'story' && $id !== null && $id !== '') {
            $dataPayload['story_id'] = (string) $id;
        }

        $apnsConfig = ApnsConfig::fromArray([
            'payload' => [
                'aps' => [
                    'sound' => 'default',
                    'badge' => 1,
                    'content-available' => 1,
                ],
            ],
        ]);

        $message = CloudMessage::new()
            ->withNotification(Notification::create($title, $body))
            ->withData($dataPayload)
            ->withApnsConfig($apnsConfig);

        $success = 0;
        $failed = 0;
        $invalidTokens = [];
        $bar = $this->output->createProgressBar(count($tokens));
        $bar->start();

        foreach (array_chunk($tokens, $chunkSize) as $chunk) {
            try {
                $report = $messaging->sendMulticast($message, $chunk);
            } catch (Throwable $e) {
                $failed += count($chunk);
                $this->newLine();
                $this->error($e->getMessage());
                $bar->advance(count($chunk));
                continue;
            }

            $success += $report->successes()->count();
            $failed += $report->failures()->count();
            $invalidTokens = array_merge($invalidTokens, $this->invalidTokens($report));
            $bar->advance(count($chunk));
        }

        $bar->finish();
        $this->newLine(2);

        $invalidTokens = array_values(array_unique(array_filter($invalidTokens)));
        $purged = 0;
        foreach (array_chunk($invalidTokens, 500) as $stale) {
            $purged += DB::table('fcm_tokens')->whereIn('token', $stale)->delete();
        }

        $this->info('Successful sends: '.$success);
        $this->info('Failed sends: '.$failed);
        $this->info('Purged tokens: '.$purged);

        return self::SUCCESS;
    }

    /**
     * Non-empty device tokens for active accounts.
     *
     * @return list<string>
     */
    private function registeredTokens(): array
    {
        return DB::table('fcm_tokens')
            ->join('users', 'users.id', '=', 'fcm_tokens.user_id')
            ->whereNull('users.deleted_at')
            ->whereNotNull('fcm_tokens.token')
            ->where('fcm_tokens.token', '!=', '')
            ->pluck('fcm_tokens.token')
            ->map(fn ($token) => trim((string) $token))
            ->filter(fn ($token) => $token !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Tokens Firebase rejected as unregistered or invalid.
     *
     * @return list<string>
     */
    private function invalidTokens(MulticastSendReport $report): array
    {
        $tokens = array_merge($report->invalidTokens(), $report->unknownTokens());

        foreach ($report->failures()->getItems() as $item) {
            $error = $item->error();
            if (! $error instanceof NotFound && ! $error instanceof InvalidArgument) {
                continue;
            }
            $token = trim($item->target()->value());
            if ($token !== '' && $token !== 'unknown') {
                $tokens[] = $token;
            }
        }

        return $tokens;
    }
}
