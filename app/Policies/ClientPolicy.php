<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Client;
use App\Models\User;
use App\Support\CurrentOrganization;

/**
 * Clients are managed (and listed) by owners and admins. Members only see client names on the
 * projects they can access.
 */
class ClientPolicy
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function viewAny(User $user): bool
    {
        return $this->canManageInCurrentOrganization($user);
    }

    public function view(User $user, Client $client): bool
    {
        return $user->hasOrganizationPermission($client->organization, OrganizationPermission::ManageClients);
    }

    public function create(User $user): bool
    {
        return $this->canManageInCurrentOrganization($user);
    }

    public function update(User $user, Client $client): bool
    {
        return $user->hasOrganizationPermission($client->organization, OrganizationPermission::ManageClients);
    }

    private function canManageInCurrentOrganization(User $user): bool
    {
        $organization = $this->currentOrganization->get();

        return $organization !== null && $user->hasOrganizationPermission($organization, OrganizationPermission::ManageClients);
    }
}
