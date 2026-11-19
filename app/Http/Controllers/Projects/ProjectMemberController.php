<?php

namespace App\Http\Controllers\Projects;

use App\Actions\Projects\AssignProjectMember;
use App\Actions\Projects\UnassignProjectMember;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\AssignProjectMemberRequest;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ProjectMemberController extends Controller
{
    public function store(AssignProjectMemberRequest $request, Project $project, AssignProjectMember $assign): RedirectResponse
    {
        Gate::authorize('update', $project);

        $assign->handle($project, User::findOrFail($request->userId()), $request->hourlyRate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member added to the project.')]);

        return back();
    }

    public function update(AssignProjectMemberRequest $request, Project $project, User $user, AssignProjectMember $assign): RedirectResponse
    {
        Gate::authorize('update', $project);
        abort_unless($project->members()->whereKey($user->id)->exists(), 404);

        $assign->handle($project, $user, $request->hourlyRate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project rate updated.')]);

        return back();
    }

    public function destroy(Project $project, User $user, UnassignProjectMember $unassign): RedirectResponse
    {
        Gate::authorize('update', $project);

        $unassign->handle($project, $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member removed from the project.')]);

        return back();
    }
}
