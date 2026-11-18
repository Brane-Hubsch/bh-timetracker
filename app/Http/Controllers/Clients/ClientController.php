<?php

namespace App\Http\Controllers\Clients;

use App\Actions\Clients\CreateClient;
use App\Actions\Clients\SetClientArchived;
use App\Actions\Clients\UpdateClient;
use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\ClientRequest;
use App\Models\Client;
use App\Models\Project;
use App\Support\CurrentOrganization;
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
            ->withCount(['projects' => fn ($query) => $query->active()])
            ->orderBy('name')
            ->get()
            ->map(fn (Client $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'organizationNumber' => $client->organization_number,
                'email' => $client->email,
                'activeProjectsCount' => $client->projects_count,
                'isArchived' => $client->isArchived(),
            ]);

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function store(ClientRequest $request, CurrentOrganization $currentOrganization, CreateClient $createClient): RedirectResponse
    {
        Gate::authorize('create', Client::class);

        $client = $createClient->handle($currentOrganization->getOrFail(), $request->clientAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Client created.')]);

        return to_route('clients.show', ['client' => $client->id]);
    }

    public function show(Client $client): Response
    {
        Gate::authorize('view', $client);

        return Inertia::render('clients/show', [
            'client' => [
                'id' => $client->id,
                'name' => $client->name,
                'organizationNumber' => $client->organization_number,
                'email' => $client->email,
                'notes' => $client->notes,
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
        ]);
    }

    public function update(ClientRequest $request, Client $client, UpdateClient $updateClient): RedirectResponse
    {
        Gate::authorize('update', $client);

        $updateClient->handle($client, $request->clientAttributes());

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
