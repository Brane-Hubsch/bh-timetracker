<?php

namespace App\Actions\Clients;

use App\Models\Client;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateClient
{
    /**
     * @param  array{name: string, website?: string|null, organization_number?: string|null, email?: string|null, notes?: string|null}  $attributes
     */
    public function handle(Organization $organization, array $attributes): Client
    {
        return DB::transaction(function () use ($organization, $attributes) {
            // Serialize client creation within the organization.
            Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();

            $name = Str::lower(Str::trim($attributes['name']));
            $exists = Client::forOrganization($organization)
                ->pluck('name')
                ->contains(fn (string $existingName) => Str::lower(Str::trim($existingName)) === $name);

            if ($exists) {
                throw ValidationException::withMessages([
                    'name' => __('A client with this name already exists.'),
                ]);
            }

            return Client::create([
                ...$attributes,
                'organization_id' => $organization->id,
            ]);
        }, attempts: 3);
    }
}
