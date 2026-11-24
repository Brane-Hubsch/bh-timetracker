<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Response;

class DisableRememberMe
{
    public function handle(Request $request, Closure $next): Response
    {
        $cookie = Auth::guard('web')->getRecallerName();
        $hadRememberCookie = $request->cookies->has($cookie);
        $request->cookies->remove($cookie);

        $response = $next($request);

        if ($hadRememberCookie || Cookie::hasQueued($cookie)) {
            Cookie::expire($cookie);
        }

        return $response;
    }
}
