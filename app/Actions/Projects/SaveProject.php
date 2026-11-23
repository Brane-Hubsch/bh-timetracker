<?php

namespace App\Actions\Projects;

use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Support\ResourceSlug;
use Illuminate\Validation\ValidationException;

/**
 * Create or update a project.
 */
class SaveProject
{
    /**
     * @param  array{name: string, client_id: int|null, code: string|null, color: string, is_billable: bool, hourly_rate: int|null, estimate_seconds: int|null, visibility: string, starts_on: string|null, ends_on: string|null, notes?: string|null}  $attributes
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, array $attributes, ?Project $project = null): Project
    {
        $this->ensureClientBelongsToOrganization($organization, $attributes['client_id']);

        if ($project === null) {
            $project = new Project([...$attributes, 'organization_id' => $organization->id]);

            return ResourceSlug::create($project, $organization->id, $attributes['name'], 'project');
        }

        $project->update($attributes);

        return $project;
    }

    /**
     * @throws ValidationException
     */
    private function ensureClientBelongsToOrganization(Organization $organization, ?int $clientId): void
    {
        if ($clientId === null) {
            return;
        }

        $exists = Client::query()->forOrganization($organization)->whereKey($clientId)->exists();

        if (! $exists) {
            throw ValidationException::withMessages(['client_id' => __('The client does not belong to this organization.')]);
        }
    }
}
