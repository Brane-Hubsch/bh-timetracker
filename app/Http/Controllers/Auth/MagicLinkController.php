<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\ConsumeMagicLink;
use App\Actions\Auth\RequestMagicLink;
use App\Actions\Auth\SendMagicLink;
use App\Http\Controllers\Auth\Concerns\StartsSessions;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MagicLinkRequest;
use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sign in with a link sent by email. Also used to recover access ("lost my passkey") and to confirm
 * access before sensitive actions for users without passkeys.
 */
class MagicLinkController extends Controller
{
    use StartsSessions;

    /**
     * Email a sign-in link. Always answers the same way so it does not reveal which accounts exist.
     */
    public function store(MagicLinkRequest $request, RequestMagicLink $requestMagicLink): RedirectResponse
    {
        $requestMagicLink->handle($request->email(), $request->redirectTo());

        return back()->with('status', __('If an account exists for that address, we have emailed a sign-in link.'));
    }

    /**
     * Email the signed-in user a link that confirms access and continues to the page that asked
     * for confirmation (for users without passkeys or password).
     */
    public function confirm(Request $request, #[CurrentUser] User $user, SendMagicLink $sendMagicLink): RedirectResponse
    {
        $intended = $request->session()->get('url.intended');
        $redirectTo = is_string($intended) ? (parse_url($intended, PHP_URL_PATH) ?: null) : null;

        $sendMagicLink->handle($user, $redirectTo);

        return back()->with('status', __('We have emailed you a confirmation link.'));
    }

    /**
     * Show the "continue" page. The link is only used on POST, so email scanners that open links do
     * not burn it.
     */
    public function show(string $token): Response
    {
        $link = MagicLink::findUsable($token);

        return Inertia::render('auth/magic-link', [
            'token' => $token,
            'isValid' => $link !== null,
            'email' => $link?->user->email,
        ]);
    }

    /**
     * Use the link and sign in.
     */
    public function consume(Request $request, string $token, ConsumeMagicLink $consumeMagicLink): RedirectResponse
    {
        $link = $consumeMagicLink->handle($token);

        if (! $link) {
            return to_route('login')->with('status', __('That sign-in link has expired or was already used. Request a new one.'));
        }

        $this->startSession($request, $link->user);

        return $this->redirectAfterSignIn($request, $link->user, $link->redirect_to);
    }
}
