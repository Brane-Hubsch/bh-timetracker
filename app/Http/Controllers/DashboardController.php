<?php

namespace App\Http\Controllers;

use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show the dashboard for the current organization.
     */
    public function __invoke(#[CurrentUser] User $user): Response
    {
        return Inertia::render('dashboard', [
            'pendingInvitations' => OrganizationInvitation::query()
                ->pendingFor($user->email)
                ->with(['inviter', 'organization'])
                ->latest()
                ->get()
                ->map(fn (OrganizationInvitation $invitation) => $invitation->toPendingInvitationData()),
        ]);
    }
}
