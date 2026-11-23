<?php

namespace App\Http\Controllers\Clients;

use App\Actions\Clients\CreateClient;
use App\Actions\Clients\SetClientArchived;
use App\Actions\Clients\UpdateClient;
use App\Actions\Images\UpdateClientLogo;
use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\ClientRequest;
use App\Http\Requests\Reports\ReportRequest;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportFilters;
use App\Support\CurrentOrganization;
use App\Support\ProjectFormOptions;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Client::class);

        $status = $request->query('status') === 'archived' ? 'archived' : 'active';
        $search = $request->string('search')->value();

        $clients = Client::query()
            ->when($status === 'archived', fn ($query) => $query->archived(), fn ($query) => $query->active())
            ->search($search)
            ->withCount([
                'projects' => fn ($query) => $query->active(),
                'projects as archived_projects_count' => fn ($query) => $query->archived(),
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (Client $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'organizationNumber' => $client->organization_number,
                'email' => $client->email,
                'logo' => $client->logoUrl(),
                'activeProjectsCount' => $client->projects_count,
                'archivedProjectsCount' => $client->getAttribute('archived_projects_count'),
                'isArchived' => $client->isArchived(),
            ]);

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'clientNameOptions' => fn () => Client::query()
                ->orderBy('name')
                ->get(['id', 'name', 'archived_at'])
                ->map(fn (Client $client) => [
                    'id' => $client->id,
                    'name' => $client->name,
                    'isArchived' => $client->isArchived(),
                ]),
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function store(ClientRequest $request, CurrentOrganization $currentOrganization, CreateClient $createClient, UpdateClientLogo $updateLogo): RedirectResponse
    {
        Gate::authorize('create', Client::class);

        $client = $createClient->handle($currentOrganization->getOrFail(), $request->clientAttributes());

        if ($request->logo() !== null) {
            $updateLogo->handle($client, $request->logo());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Client created.')]);

        return to_route('clients.show', ['client' => $client->id]);
    }

    public function show(ReportRequest $request, #[CurrentUser] User $user, Client $client, ReportBuilder $reports, CurrentOrganization $currentOrganization, ProjectFormOptions $formOptions): Response
    {
        Gate::authorize('view', $client);

        $period = $request->filters($user, $currentOrganization->getOrFail());
        $filters = new ReportFilters($period->organization, $user, $period->from, $period->to, clientIds: [$client->id]);
        $summary = $reports->summary($filters, ReportGrouping::Project);

        return Inertia::render('clients/show', [
            'client' => [
                'id' => $client->id,
                'name' => $client->name,
                'organizationNumber' => $client->organization_number,
                'email' => $client->email,
                'notes' => $client->notes,
                'website' => $client->website,
                'logo' => $client->logoUrl(256),
                'isArchived' => $client->isArchived(),
            ],
            'projects' => $client->projects()
                ->orderByRaw('archived_at IS NOT NULL')
                ->orderBy('name')
                ->get()
                ->map(fn (Project $project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'color' => $project->color,
                    'isArchived' => $project->isArchived(),
                ]),
            // Time reported on the client's projects in the chosen period.
            'report' => [
                'period' => $request->period()->value,
                'from' => $filters->from?->toDateString() ?? '',
                'to' => $filters->to?->toDateString() ?? '',
                'periods' => ReportPeriod::options(),
                'totals' => $summary['totals'],
                'projects' => array_map(fn (array $group) => [
                    'id' => (int) $group['key'],
                    'name' => $group['label'],
                    'color' => $group['color'],
                    'seconds' => $group['seconds'],
                    'billableSeconds' => $group['billableSeconds'],
                    'amount' => $group['amount'],
                ], $summary['groups']),
            ],
            'currency' => $currentOrganization->getOrFail()->currency,
            'projectForm' => $user->can('create', Project::class) ? $formOptions->for($period->organization) : null,
        ]);
    }

    public function update(ClientRequest $request, Client $client, UpdateClient $updateClient, UpdateClientLogo $updateLogo): RedirectResponse
    {
        Gate::authorize('update', $client);

        $updateClient->handle($client, $request->clientAttributes());

        if ($request->logo() !== null || $request->removesLogo()) {
            $updateLogo->handle($client, $request->logo());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Client updated.')]);

        return back();
    }

    public function archive(Client $client, SetClientArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $client);

        $setArchived->handle($client, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Client archived.')]);

        return back();
    }

    public function restore(Client $client, SetClientArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $client);

        $setArchived->handle($client, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Client restored.')]);

        return back();
    }
}
