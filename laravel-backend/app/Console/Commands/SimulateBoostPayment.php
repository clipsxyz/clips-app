<?php

namespace App\Console\Commands;

use App\Models\Boost;
use Illuminate\Console\Command;

class SimulateBoostPayment extends Command
{
    protected $signature = 'boost:simulate-payment {boost_id}';

    protected $description = 'Mark a pending post boost as paid and active for local testing';

    public function handle(): int
    {
        $boost = Boost::query()->find($this->argument('boost_id'));
        if (! $boost) {
            $this->error('Boost not found.');

            return self::FAILURE;
        }

        $hours = (int) ($boost->duration_hours ?: 6);
        if ($hours < 1) {
            $hours = 6;
        }

        $boost->forceFill([
            'status' => 'active',
            'activated_at' => now(),
            'expires_at' => now()->addHours($hours),
        ])->save();

        $this->info("Boost {$boost->id} is now active until {$boost->expires_at->toDateTimeString()}.");

        return self::SUCCESS;
    }
}
