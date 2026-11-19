<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\AuthenticateWithGoogle;
use App\Data\GoogleProfile;
use App\Exceptions\SignInNotAllowedException;
use App\Http\Controllers\Auth\Concerns\StartsSessions;
use App\Http\Controllers\Controller;
use App\Models\OrganizationInvitation;
use App\Support\SignInOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class GoogleController extends Controller
{
    use StartsSessions;

    /**
     * Send the user to Google. An invitation code is remembered so it can be accepted on return.
     */
    public function redirect(Request $request, SignInOptions $options): SymfonyRedirectResponse
    {
        abort_unless($options->google(), 404);

        $invitation = $request->query('invitation');
        $request->session()->put('google_invitation', is_string($invitation) ? $invitation : null);

        return Socialite::driver('google')->redirect();
    }

    /**
     * Handle Google's callback: sign in, link or create the account.
     */
    public function callback(Request $request, SignInOptions $options, AuthenticateWithGoogle $authenticateWithGoogle): RedirectResponse
    {
        abort_unless($options->google(), 404);

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable) {
            // Denied consent, invalid state or a provider error.
            return to_route('login')->with('status', __('Google sign-in was cancelled or failed. Please try again.'));
        }

        $code = $request->session()->pull('google_invitation');
        $invitation = is_string($code) ? OrganizationInvitation::query()->where('code', $code)->first() : null;

        try {
            $user = $authenticateWithGoogle->handle(GoogleProfile::fromSocialite($googleUser), $invitation);
        } catch (SignInNotAllowedException $exception) {
            return to_route('login')->with('status', $exception->getMessage());
        }

        $this->startSession($request, $user);

        // Google users can keep using Google; only suggest a passkey to brand new accounts.
        return $this->redirectAfterSignIn($request, $user, offerPasskeySetup: $user->wasRecentlyCreated);
    }
}
