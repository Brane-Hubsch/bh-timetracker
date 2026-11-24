<?php

namespace App\Http\Controllers\Auth\Concerns;

use App\Http\Responses\Concerns\RedirectsToCurrentOrganization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Shared sign-in handling for magic links, Google and new accounts from invitations.
 */
trait StartsSessions
{
    use RedirectsToCurrentOrganization;

    /**
     * Log the user in. A fresh sign-in counts as a recent confirmation, so the user can manage
     * passkeys right away without a password.
     */
    protected function startSession(Request $request, User $user): void
    {
        Auth::login($user);

        $request->session()->regenerate();
        $request->session()->passwordConfirmed();
    }

    /**
     * Where to go after signing in: an explicit target, the passkey setup (when offered and the user
     * has no passkey yet), otherwise the current organization.
     */
    protected function redirectAfterSignIn(Request $request, User $user, ?string $redirectTo = null, bool $offerPasskeySetup = true): RedirectResponse
    {
        if ($redirectTo !== null) {
            return redirect($redirectTo);
        }

        if ($offerPasskeySetup && ! $user->hasPasskeys()) {
            return to_route('passkey-setup');
        }

        return redirect()->intended($this->redirectPathForCurrentOrganization($request, config()->string('fortify.home')));
    }
}
