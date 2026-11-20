<?php

namespace App\Support;

use App\Models\Membership;
use App\Models\Organization;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;

/**
 * Resolves the hourly rate (minor currency unit, öre) for a user's time on a project:
 * project member rate → project rate → the member's rate in the organization → organization default.
 * Time entries snapshot the resolved rate when they are saved.
 */
class RateResolver
{
    public function resolve(Project $project, User $user): ?int
    {
        $projectMember = ProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if ($projectMember?->hourly_rate !== null) {
            return $projectMember->hourly_rate;
        }

        if ($project->hourly_rate !== null) {
            return $project->hourly_rate;
        }

        return $this->forMember($project->organization, $user);
    }

    /**
     * The rate without a project: the member's rate in the organization, else its default. Used for
     * projects that don't exist yet (e.g. in an import preview).
     */
    public function forMember(Organization $organization, User $user): ?int
    {
        $membership = Membership::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->first();

        return $membership->hourly_rate ?? $organization->default_hourly_rate;
    }
}
