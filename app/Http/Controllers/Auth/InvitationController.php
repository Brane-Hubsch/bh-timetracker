<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\CreateUserFromInvitation;
use App\Exceptions\SignInNotAllowedException;
use App\Http\Controllers\Auth\Concerns\StartsSessions;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\InvitationAccountRequest;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Support\SignInOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page an invitation email links to. New users create their account here (name → passkey, or
 * Google); existing users sign in and accept.
 */
class InvitationController extends Controller
{
    use StartsSessions;

    public function show(Request $request, OrganizationInvitation $invitation, SignInOptions $options): Response
    {
        $invitation->loadMissing(['organization', 'inviter']);
        $user = $request->user();

        return Inertia::render('auth/invitation', [
            'invitation' => [
                'code' => $invitation->code,
                'email' => $invitation->email,
                'organizationName' => $invitation->organization->name,
                'inviterName' => $invitation->inviter->name,
                'roleLabel' => $invitation->role->label(),
                'status' => match (true) {
                    $invitation->isAccepted() => 'accepted',
                    $invitation->isExpired() => 'expired',
                    default => 'pending',
                },
            ],
            'accountExists' => User::query()->whereRaw('LOWER(email) = ?', [mb_strtolower($invitation->email)])->exists(),
            'signedInEmail' => $user instanceof User ? $user->email : null,
            'google' => $options->google(),
        ]);
    }

    public function store(InvitationAccountRequest $request, OrganizationInvitation $invitation, CreateUserFromInvitation $createUser): RedirectResponse
    {
        try {
            $user = $createUser->handle($invitation, $request->userName());
        } catch (SignInNotAllowedException $exception) {
            return back()->withErrors(['name' => $exception->getMessage()]);
        }

        $this->startSession($request, $user);

        return to_route('passkey-setup');
    }
}
