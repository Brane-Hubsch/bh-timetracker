<?php

namespace App\Providers;

use App\Models\User;
use App\Support\CurrentOrganization;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterval;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use Laravel\Passport\Scope;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(CurrentOrganization::class);

        // OAuth is only used by MCP clients (authorization code grant with PKCE); no device flow.
        Passport::$deviceCodeGrantEnabled = false;
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureMcp();
    }

    /**
     * OAuth (Passport) for MCP clients such as Claude, and the MCP rate limits.
     */
    protected function configureMcp(): void
    {
        Passport::tokensExpireIn(CarbonInterval::day());
        Passport::refreshTokensExpireIn(CarbonInterval::days(60));

        Passport::authorizationView(function (array $parameters) {
            /** @var Client $client */
            $client = $parameters['client'];
            /** @var array<int, Scope> $scopes */
            $scopes = $parameters['scopes'];
            /** @var Request $request */
            $request = $parameters['request'];
            $redirectUri = $request->query('redirect_uri', $client->redirect_uris[0] ?? null);

            return Inertia::render('auth/oauth-authorize', [
                'client' => ['id' => $client->getKey(), 'name' => $client->name],
                'redirectHost' => is_string($redirectUri) ? parse_url($redirectUri, PHP_URL_HOST) : null,
                'scopes' => array_map(fn (Scope $scope) => $scope->id, $scopes),
                'state' => $request->query('state'),
                'authToken' => $parameters['authToken'],
                'csrfToken' => csrf_token(),
                'action' => route('passport.authorizations.approve'),
            ])->toResponse($request);
        });

        RateLimiter::for('mcp', function (Request $request) {
            $user = $request->user();

            return Limit::perMinute(120)->by($user instanceof User ? 'user:'.$user->id : 'ip:'.$request->ip());
        });

        RateLimiter::for('mcp-oauth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
