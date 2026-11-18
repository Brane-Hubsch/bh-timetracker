<?php

namespace App\Actions\Projects;

use App\Models\Project;

class SetProjectArchived
{
    /**
     * Archive or restore a project. Archived projects are hidden from pickers but stay in reports.
     */
    public function handle(Project $project, bool $archived): Project
    {
        $project->update(['archived_at' => $archived ? ($project->archived_at ?? now()) : null]);

        return $project;
    }
}
