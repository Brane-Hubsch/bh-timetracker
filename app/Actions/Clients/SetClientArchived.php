<?php

namespace App\Actions\Clients;

use App\Models\Client;

class SetClientArchived
{
    /**
     * Archive or restore a client. Archived clients (and their projects) are hidden from pickers but
     * stay in reports. Projects are not archived along with the client.
     */
    public function handle(Client $client, bool $archived): Client
    {
        $client->update(['archived_at' => $archived ? ($client->archived_at ?? now()) : null]);

        return $client;
    }
}
