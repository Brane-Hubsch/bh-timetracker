<?php

namespace App\Http\Responses\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

trait RedirectsToCurrentOrganization
{
    /**
     * Get the post-authentication redirect path inside the user's current organization.
     *
     * Users without any organization are sent to onboarding, where they can accept a pending
     * invitation or create an organization.
     */
    protected function redirectPathForCurrentOrganization(Request $request, string $redirect): string
    {
        $user = $request->user();

        abort_if(! $user, 403);

        $organization = $user->currentOrganization ?? $user->resetCurrentOrganization();

        if (! $organization) {
            return route('onboarding', absolute: false);
        }

        URL::defaults(['current_organization' => $organization->slug]);

        return "/{$organization->slug}{$redirect}";
    }
}
