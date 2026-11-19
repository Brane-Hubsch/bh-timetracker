<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;

class UnassignProjectMember
{
    /**
     * Remove a user from the project. Their reported time stays.
     */
    public function handle(Project $project, User $user): Project
    {
        $project->members()->detach($user->id);

        return $project;
    }
}
