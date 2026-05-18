<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class TrackLastActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if (!$user) {
            return $response;
        }

        $touchMinutes = (int) config('engagement.last_active_touch_minutes', 5);
        $shouldTouch = !$user->last_active_at
            || $user->last_active_at->lt(now()->subMinutes($touchMinutes));

        if ($shouldTouch) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        return $response;
    }
}
