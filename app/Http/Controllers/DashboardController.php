<?php

namespace App\Http\Controllers;

use App\Models\OrganizationInvitation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show the dashboard for the current organization.
     */
    public function __invoke(Request $request): Response
    {
        return Inertia::render('dashboard', [
            'pendingInvitations' => OrganizationInvitation::query()
                ->pendingFor($request->user()->email)
                ->with(['inviter', 'organization'])
                ->latest()
                ->get()
                ->map(fn (OrganizationInvitation $invitation) => $invitation->toPendingInvitationData()),
        ]);
    }
}
