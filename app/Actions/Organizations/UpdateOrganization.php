<?php

namespace App\Actions\Organizations;

use App\Enums\Accent;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;

class UpdateOrganization
{
    /**
     * Update the organization's name and settings.
     *
     * @param  array{name?: string, currency?: string, default_hourly_rate?: int|null, week_starts_on?: int, timezone?: string, workday_seconds?: int, timer_enabled?: bool, accent?: Accent|null}  $attributes
     */
    public function handle(Organization $organization, array $attributes): Organization
    {
        return DB::transaction(function () use ($organization, $attributes) {
            $organization = Organization::whereKey($organization->id)->lockForUpdate()->firstOrFail();

            $organization->update($attributes);

            return $organization;
        });
    }
}
