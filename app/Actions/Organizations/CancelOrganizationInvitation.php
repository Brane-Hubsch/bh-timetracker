<?php

namespace App\Actions\Organizations;

use App\Models\OrganizationInvitation;

class CancelOrganizationInvitation
{
    /**
     * Cancel a pending invitation, so its link stops working.
     */
    public function handle(OrganizationInvitation $invitation): void
    {
        $invitation->delete();
    }
}
