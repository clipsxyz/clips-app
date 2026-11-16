<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * asset() and Storage::url() read a fixed root. Point them at the host that
 * actually called the API (localhost, a LAN IP, or the public domain).
 */
class AlignPublicUrlsWithRequest
{
    public function handle(Request $request, Closure $next)
    {
        $root = rtrim($request->getSchemeAndHttpHost(), '/');
        if ($root !== '') {
            URL::forceRootUrl($root);
            config(['filesystems.disks.public.url' => $root.'/storage']);
        }

        return $next($request);
    }
}
