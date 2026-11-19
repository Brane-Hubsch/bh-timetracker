<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RenamePasskey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\RenamePasskeyRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passkeys\Passkey;

class SecurityController extends Controller
{
    /**
     * Show the user's passkeys.
     */
    public function edit(#[CurrentUser] User $user): Response
    {
        return Inertia::render('settings/security', [
            'passkeys' => $user->passkeys()
                ->select(['id', 'name', 'credential', 'created_at', 'last_used_at'])
                ->latest()
                ->get()
                ->map(fn (Passkey $passkey) => [
                    'id' => $passkey->id,
                    'name' => $passkey->name,
                    'authenticator' => $passkey->authenticator,
                    'created_at_diff' => $passkey->created_at?->diffForHumans(),
                    'last_used_at_diff' => $passkey->last_used_at?->diffForHumans(),
                ])
                ->values()
                ->all(),
        ]);
    }

    /**
     * Rename one of the user's passkeys.
     */
    public function rename(RenamePasskeyRequest $request, #[CurrentUser] User $user, Passkey $passkey, RenamePasskey $renamePasskey): RedirectResponse
    {
        $renamePasskey->handle($user, $passkey, $request->passkeyName());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Passkey renamed.')]);

        return back();
    }
}
