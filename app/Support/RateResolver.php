<?php

namespace App\Support;

use App\Models\Membership;
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

        $membership = Membership::query()
            ->where('organization_id', $project->organization_id)
            ->where('user_id', $user->id)
            ->first();

        return $membership->hourly_rate ?? $project->organization->default_hourly_rate;
    }
}
