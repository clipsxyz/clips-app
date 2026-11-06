<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    private bool $scheduleBootstrapped = false;

    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('engagement:send-inactive-digests')
            ->dailyAt('09:00')
            ->withoutOverlapping();
    }

    /**
     * Use the schedule built while routes/console.php was loaded, so
     * Schedule::command() registrations are the ones artisan runs.
     */
    public function resolveConsoleSchedule()
    {
        if ($this->app->resolved(Schedule::class)) {
            $schedule = $this->app->make(Schedule::class);
            if (! $this->scheduleBootstrapped) {
                $this->schedule($schedule->useCache($this->scheduleCache()));
                $this->scheduleBootstrapped = true;
            }

            return $schedule;
        }

        return parent::resolveConsoleSchedule();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}






















