<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For API routes, don't redirect - just return null
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }
        // For web routes, try to redirect to login (but don't fail if route doesn't exist)
        try {
            return route('login');
        } catch (\Exception $e) {
            return null;
        }
    }
}

