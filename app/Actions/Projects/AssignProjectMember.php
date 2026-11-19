<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AssignProjectMember
{
    /**
     * Assign an active organization member to the project, or update their project rate.
     *
     * @param  int|null  $hourlyRate  Minor currency unit (öre); null uses the project/member default.
     *
     * @throws ValidationException
     */
    public function handle(Project $project, User $user, ?int $hourlyRate = null): Project
    {
        if (! $user->belongsToOrganization($project->organization)) {
            throw ValidationException::withMessages(['user_id' => __('The user is not a member of the organization.')]);
        }

        $project->members()->syncWithoutDetaching([$user->id => ['hourly_rate' => $hourlyRate]]);

        return $project;
    }
}
