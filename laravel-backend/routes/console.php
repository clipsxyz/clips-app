<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('fcm:prune')->weekly();
Schedule::command('gazetteer:prune-notifications')->daily();

// Manual `php artisan gazetteer:fetch-news` still runs when this is false.
Schedule::command('gazetteer:fetch-news')
    ->everyThreeHours()
    ->withoutOverlapping()
    ->when(fn () => (bool) config('automated_seeding.enabled'));

