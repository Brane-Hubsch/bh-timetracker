<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Responses\Concerns\RedirectsToCurrentOrganization;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Offered right after sign-up or an email-link sign-in: create a passkey for next time.
 */
class PasskeySetupController extends Controller
{
    use RedirectsToCurrentOrganization;

    public function __invoke(Request $request): Response
    {
        // Continue where the user was headed before signing in (e.g. an MCP client's OAuth approval).
        $intended = $request->session()->pull('url.intended');

        return Inertia::render('auth/passkey-setup', [
            'continueTo' => is_string($intended) ? $intended : $this->redirectPathForCurrentOrganization($request, config()->string('fortify.home')),
        ]);
    }
}
