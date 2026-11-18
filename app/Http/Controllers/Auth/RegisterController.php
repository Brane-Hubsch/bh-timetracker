<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\RegisterUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Support\SignInOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Self-registration without Google: name + email → magic link → passkey. Only available when open
 * registration is enabled; otherwise accounts are created from invitations.
 */
class RegisterController extends Controller
{
    public function create(Request $request, SignInOptions $options): Response
    {
        abort_unless($options->openRegistration(), 404);

        return Inertia::render('auth/register', [
            'google' => $options->google(),
            'status' => $request->session()->get('status'),
        ]);
    }

    public function store(RegisterRequest $request, SignInOptions $options, RegisterUser $registerUser): RedirectResponse
    {
        abort_unless($options->openRegistration(), 404);

        $registerUser->handle($request->userName(), $request->email());

        return back()->with('status', __('Check your inbox: we have emailed you a link to finish creating your account.'));
    }
}
