<?php

namespace App\Providers;

use App\Http\Responses\LoginResponse;
use App\Http\Responses\PasskeyLoginResponse;
use App\Http\Responses\VerifyEmailResponse;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Support\SignInOptions;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Laravel\Fortify\Contracts\VerifyEmailResponse as VerifyEmailResponseContract;
use Laravel\Fortify\Fortify;
use Laravel\Passkeys\Contracts\PasskeyLoginResponse as PasskeyLoginResponseContract;

/**
 * Fortify provides the login page, passkeys, logout, password confirmation and email verification.
 * Password login is only accepted when SignInOptions::passwordLogin() allows it (never in production).
 */
class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(LoginResponseContract::class, LoginResponse::class);
        $this->app->singleton(PasskeyLoginResponseContract::class, PasskeyLoginResponse::class);
        $this->app->singleton(VerifyEmailResponseContract::class, VerifyEmailResponse::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureAuthentication();
        $this->configureViews();
        $this->configureRateLimiting();
    }

    /**
     * Password login (development and tests only).
     */
    private function configureAuthentication(): void
    {
        Fortify::authenticateUsing(function (Request $request): ?User {
            if (! app(SignInOptions::class)->passwordLogin()) {
                throw ValidationException::withMessages([
                    Fortify::username() => __('Password login is disabled. Use a passkey, Google or an email link.'),
                ]);
            }

            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [$request->string(Fortify::username())->lower()->value()])
                ->first();

            $password = $request->string('password')->value();

            return $user && $user->password !== null && Hash::check($password, $user->password) ? $user : null;
        });
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'status' => $request->session()->get('status'),
            'signInOptions' => app(SignInOptions::class)->toArray(),
            'organizationInvitation' => $this->organizationInvitation($request),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::confirmPasswordView(fn (Request $request) => Inertia::render('auth/confirm-access', [
            'status' => $request->session()->get('status'),
            'hasPasskeys' => $request->user() instanceof User && $request->user()->hasPasskeys(),
            'passwordLogin' => app(SignInOptions::class)->passwordLogin(),
        ]));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate($request->string(Fortify::username())->lower()->value().'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('magic-link', function (Request $request) {
            return [
                Limit::perMinute(3)->by('email:'.$request->string('email')->lower()->value()),
                Limit::perMinute(10)->by('ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('passkeys', function (Request $request) {
            $credentialId = $request->string('credential.id')->value();

            return Limit::perMinute(10)->by(
                ($credentialId !== '' ? $credentialId : $request->session()->getId()).'|'.$request->ip(),
            );
        });
    }

    /**
     * The invitation the user is signing in to accept, if any.
     *
     * @return array{code: string, organizationName: string}|null
     */
    private function organizationInvitation(Request $request): ?array
    {
        $invitationCode = $request->query('invitation');

        if (! is_string($invitationCode)) {
            return null;
        }

        $invitation = OrganizationInvitation::query()
            ->with('organization')
            ->where('code', $invitationCode)
            ->whereNull('accepted_at')
            ->where(fn ($query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>=', now()))
            ->first();

        if (! $invitation) {
            return null;
        }

        return [
            'code' => $invitation->code,
            'organizationName' => $invitation->organization->name,
        ];
    }
}
