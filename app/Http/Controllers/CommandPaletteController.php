<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationPermission;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

/**
 * Searchable items for the ⌘K command palette, loaded when it is first opened: projects the user
 * can report on, and for owners/admins clients and members. Same visibility as the rest of the app.
 */
class CommandPaletteController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, CurrentOrganization $currentOrganization): JsonResponse
    {
        $organization = $currentOrganization->getOrFail();

        $projects = Project::query()
            ->accessibleBy($user, $organization)
            ->active()
            ->where(fn (Builder $query) => $query
                ->whereNull('client_id')
                ->orWhereHas('client', fn (Builder $query) => $query->whereNull('archived_at')))
            ->with('client:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'code' => $project->code,
                'color' => $project->color,
                'clientName' => $project->client?->name,
            ]);

        $clients = $user->hasOrganizationPermission($organization, OrganizationPermission::ManageClients)
            ? Client::query()->whereNull('archived_at')->orderBy('name')->get(['id', 'name'])
                ->map(fn (Client $client) => ['id' => $client->id, 'name' => $client->name])
            : [];

        $members = $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime)
            ? $organization->members()->wherePivotNull('deactivated_at')->orderBy('name')->get(['users.id', 'users.name'])
                ->map(fn (User $member) => ['id' => $member->id, 'name' => $member->name])
            : [];

        return response()->json([
            'projects' => $projects->values(),
            'clients' => collect($clients)->values(),
            'members' => collect($members)->values(),
        ]);
    }
}
