<?php

namespace App\Http\Controllers\Projects;

use App\Actions\Projects\SaveProject;
use App\Actions\Projects\SetProjectArchived;
use App\Enums\ProjectVisibility;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectRequest;
use App\Models\Client;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function index(Request $request, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', Project::class);

        $organization = $this->currentOrganization->getOrFail();
        $status = $request->query('status') === 'archived' ? 'archived' : 'active';
        $search = $request->string('search')->value();
        $clientId = $request->integer('client') ?: null;

        $projects = Project::query()
            ->accessibleBy($user, $organization)
            ->with('client')
            ->when($status === 'archived', fn ($query) => $query->archived(), fn ($query) => $query->active())
            ->when($clientId, fn ($query) => $query->where('client_id', $clientId))
            ->search($search)
            ->orderBy('name')
            ->get();

        return Inertia::render('projects/index', [
            'projects' => $projects->map(fn (Project $project) => $this->listItem($project)),
            'clients' => Client::query()->active()->orderBy('name')->get(['id', 'name'])
                ->when(! $user->can('viewAny', Client::class), fn ($clients) => $clients
                    ->whereIn('id', $projects->pluck('client_id')->filter()->all())
                    ->values()),
            'filters' => ['search' => $search, 'status' => $status, 'client' => $clientId],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', Project::class);

        return Inertia::render('projects/form', [
            'project' => null,
            'defaultClientId' => $request->integer('client') ?: null,
            ...$this->formOptions(),
        ]);
    }

    public function store(ProjectRequest $request, SaveProject $saveProject): RedirectResponse
    {
        Gate::authorize('create', Project::class);

        $project = $saveProject->handle($this->currentOrganization->getOrFail(), $request->projectAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project created.')]);

        return to_route('projects.show', ['project' => $project->id]);
    }

    public function show(#[CurrentUser] User $user, Project $project): Response
    {
        Gate::authorize('view', $project);

        $project->load(['client', 'members']);
        $organization = $this->currentOrganization->getOrFail();
        $canViewRates = $user->can('viewRates', $organization);
        $canManage = $user->can('update', $project);

        return Inertia::render('projects/show', [
            'project' => [
                ...$this->listItem($project),
                'hourlyRate' => $canViewRates ? $project->hourly_rate : null,
                'visibility' => $project->visibility->value,
                'startsOn' => $project->starts_on?->toDateString(),
                'endsOn' => $project->ends_on?->toDateString(),
                'consumedSeconds' => $project->consumedSeconds(),
            ],
            'members' => $project->members->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'avatar' => $member->avatar_url,
                'hourlyRate' => $canViewRates ? $this->assignment($member)?->hourly_rate : null,
            ]),
            'assignableMembers' => $canManage
                ? $organization->members()
                    ->wherePivotNull('deactivated_at')
                    ->whereNotIn('users.id', $project->members->modelKeys())
                    ->orderBy('name')
                    ->get(['users.id', 'users.name'])
                    ->map(fn (User $member) => ['value' => (string) $member->id, 'label' => $member->name])
                : [],
            'currency' => $organization->currency,
            'abilities' => [
                'manage' => $canManage,
                'viewRates' => $canViewRates,
            ],
        ]);
    }

    public function edit(#[CurrentUser] User $user, Project $project): Response
    {
        Gate::authorize('update', $project);

        return Inertia::render('projects/form', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'clientId' => $project->client_id,
                'code' => $project->code,
                'color' => $project->color,
                'isBillable' => $project->is_billable,
                'hourlyRate' => $project->hourly_rate,
                'estimateSeconds' => $project->estimate_seconds,
                'visibility' => $project->visibility->value,
                'startsOn' => $project->starts_on?->toDateString(),
                'endsOn' => $project->ends_on?->toDateString(),
            ],
            'defaultClientId' => null,
            ...$this->formOptions(),
        ]);
    }

    public function update(ProjectRequest $request, Project $project, SaveProject $saveProject): RedirectResponse
    {
        Gate::authorize('update', $project);

        $saveProject->handle($this->currentOrganization->getOrFail(), $request->projectAttributes(), $project);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project updated.')]);

        return to_route('projects.show', ['project' => $project->id]);
    }

    public function archive(Project $project, SetProjectArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $project);

        $setArchived->handle($project, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project archived.')]);

        return back();
    }

    public function restore(Project $project, SetProjectArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $project);

        $setArchived->handle($project, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project restored.')]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function listItem(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'code' => $project->code,
            'color' => $project->color,
            'client' => $project->client ? ['id' => $project->client->id, 'name' => $project->client->name] : null,
            'isBillable' => $project->is_billable,
            'estimateSeconds' => $project->estimate_seconds,
            'isPrivate' => $project->visibility === ProjectVisibility::Private,
            'isArchived' => $project->isArchived(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        $organization = $this->currentOrganization->getOrFail();

        return [
            'clients' => Client::query()->active()->orderBy('name')->get()
                ->map(fn (Client $client) => ['value' => (string) $client->id, 'label' => $client->name]),
            'colors' => Project::COLORS,
            'currency' => $organization->currency,
        ];
    }

    /**
     * The project_members pivot loaded through Project::members().
     */
    private function assignment(User $member): ?ProjectMember
    {
        $assignment = $member->getRelation('assignment');

        return $assignment instanceof ProjectMember ? $assignment : null;
    }
}
