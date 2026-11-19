<?php

namespace App\Actions\Clients;

use App\Models\Client;

class UpdateClient
{
    /**
     * @param  array{name?: string, organization_number?: string|null, email?: string|null, notes?: string|null}  $attributes
     */
    public function handle(Client $client, array $attributes): Client
    {
        $client->update($attributes);

        return $client;
    }
}
