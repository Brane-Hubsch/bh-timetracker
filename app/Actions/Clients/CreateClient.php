<?php

namespace App\Actions\Clients;

use App\Models\Client;
use App\Models\Organization;
use App\Support\ResourceSlug;

class CreateClient
{
    /**
     * @param  array{name: string, website?: string|null, organization_number?: string|null, email?: string|null, notes?: string|null}  $attributes
     */
    public function handle(Organization $organization, array $attributes): Client
    {
        $client = new Client([
            ...$attributes,
            'organization_id' => $organization->id,
        ]);

        return ResourceSlug::create($client, $organization->id, $attributes['name'], 'client');
    }
}
