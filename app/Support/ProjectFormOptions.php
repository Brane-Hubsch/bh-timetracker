<?php

namespace App\Support;

use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;

/**
 * Choices for the project form drawer (create/edit), shared by the pages that open it.
 */
class ProjectFormOptions
{
    /**
     * @return array{clients: array<int, array{value: string, label: string}>, colors: list<string>, currency: string}
     */
    public function for(Organization $organization): array
    {
        return [
            'clients' => Client::query()
                ->forOrganization($organization)
                ->active()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Client $client) => ['value' => (string) $client->id, 'label' => $client->name])
                ->all(),
            'colors' => Project::COLORS,
            'currency' => $organization->currency,
        ];
    }
}
