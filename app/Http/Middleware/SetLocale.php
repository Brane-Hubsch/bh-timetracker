<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Use the authenticated user's locale, falling back to the application default.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var array<int, string> $available */
        $available = config('app.available_locales', []);
        $locale = $request->user()?->locale;

        if (is_string($locale) && in_array($locale, $available, true)) {
            app()->setLocale($locale);
        }

        return $next($request);
    }
}
