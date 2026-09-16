<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // Ceiling for the global API group. Feed browsing uses api-feed (120);
            // keep this ≥ feed so named feed limits are not capped by the group.
            // Local device debugging (feed + profile + stories) spikes quickly.
            $perMinute = $this->app->environment('local') ? 300 : 120;
            return Limit::perMinute($perMinute)->by($request->user()?->id ?: $request->ip());
        });

        // Infinite-scroll feed + post reads — 120/min per user or IP.
        RateLimiter::for('api-feed', function (Request $request) {
            $perMinute = $this->app->environment('local') ? 300 : 120;
            return Limit::perMinute($perMinute)->by($request->user()?->id ?: $request->ip());
        });

        // Uploads, post/story create, AI music — tighter 20/min per user or IP.
        RateLimiter::for('api-media', function (Request $request) {
            $perMinute = $this->app->environment('local') ? 60 : 20;
            return Limit::perMinute($perMinute)->by($request->user()?->id ?: $request->ip());
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}

