<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * OAuth authorization requests end with a redirect to the client (e.g. claude.ai), which an Inertia
 * XHR visit cannot follow. When an Inertia visit lands on the authorize page (typically right after
 * signing in), load it as a full page instead.
 */
class LeaveInertiaForOAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->header('X-Inertia') && $request->isMethod('GET') && $request->routeIs('passport.authorizations.authorize')) {
            return Inertia::location($request->fullUrl());
        }

        return $next($request);
    }
}
