<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Chrome Private Network Access: phone/LAN Vite ( :5173 ) → Laravel ( :8000 ).
 */
class AllowPrivateNetworkCors
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);
        $response->headers->set('Access-Control-Allow-Private-Network', 'true');

        return $response;
    }
}
