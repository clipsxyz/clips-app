<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts developer-only helper routes to local and testing environments.
 *
 * These routes seed accounts with known passwords, enumerate user handles and
 * mutate follow relationships, so they must never be reachable on a deployed
 * environment. Responds 404 (not 403) so the routes do not advertise themselves.
 */
class EnsureLocalEnvironment
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!app()->environment(['local', 'testing'])) {
            abort(404);
        }

        return $next($request);
    }
}
