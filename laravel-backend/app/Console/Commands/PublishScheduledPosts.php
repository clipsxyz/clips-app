<?php

namespace App\Console\Commands;

use App\Services\PublishScheduledContent;
use Illuminate\Console\Command;

class PublishScheduledPosts extends Command
{
    protected $signature = 'posts:publish-scheduled';

    protected $description = 'Publish scheduled posts and Shorts whose time has arrived.';

    public function handle(PublishScheduledContent $publisher): int
    {
        $result = $publisher->publishDue();
        $this->info("Published {$result['posts']} scheduled post(s) and {$result['shorts']} Short(s).");

        return self::SUCCESS;
    }
}
