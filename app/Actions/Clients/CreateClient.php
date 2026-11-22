<?php

namespace App\Actions\Clients;

use App\Models\Client;
use App\Models\Organization;

class CreateClient
{
    /**
     * @param  array{name: string, website?: string|null, organization_number?: string|null, email?: string|null, notes?: string|null}  $attributes
     */
    public function handle(Organization $organization, array $attributes): Client
    {
        return Client::create([
            ...$attributes,
            'organization_id' => $organization->id,
        ]);
    }
}
