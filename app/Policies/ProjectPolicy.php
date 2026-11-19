<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Project;
use App\Models\User;
use App\Support\CurrentOrganization;

/**
 * Everyone in the organization lists the projects they can access (public ones and those they are
 * assigned to; owners/admins see all). Owners and admins manage projects.
 */
class ProjectPolicy
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function viewAny(User $user): bool
    {
        $organization = $this->currentOrganization->get();

        return $organization !== null && $user->belongsToOrganization($organization);
    }

    public function view(User $user, Project $project): bool
    {
        return $project->isAccessibleBy($user);
    }

    public function create(User $user): bool
    {
        $organization = $this->currentOrganization->get();

        return $organization !== null && $user->hasOrganizationPermission($organization, OrganizationPermission::ManageProjects);
    }

    public function update(User $user, Project $project): bool
    {
        return $user->hasOrganizationPermission($project->organization, OrganizationPermission::ManageProjects);
    }
}
