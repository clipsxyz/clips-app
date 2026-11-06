<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Factory;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(Messaging::class, function () {
            $credentials = config('services.firebase.credentials');
            if (! is_string($credentials) || $credentials === '' || ! is_readable($credentials)) {
                throw new RuntimeException('Firebase credentials are not configured');
            }

            return (new Factory)->withServiceAccount($credentials)->createMessaging();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::preventLazyLoading(!app()->isProduction());
    }
}






















