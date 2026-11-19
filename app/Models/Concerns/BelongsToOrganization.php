<?php

namespace App\Models\Concerns;

use App\Models\Organization;
use App\Models\Scopes\OrganizationScope;
use App\Support\CurrentOrganization;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * For models with an `organization_id` column (tenant data).
 *
 * - Queries are restricted to the active organization (OrganizationScope).
 * - New models get the active organization's id when none is given.
 *
 * @mixin Model
 */
trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope(new OrganizationScope);

        static::creating(function (Model $model): void {
            if ($model->getAttribute('organization_id') === null) {
                $model->setAttribute('organization_id', app(CurrentOrganization::class)->getOrFail()->id);
            }
        });
    }

    /**
     * Get the organization the model belongs to.
     *
     * @return BelongsTo<Organization, $this>
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Scope the query to the given organization, regardless of the active organization.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function forOrganization(Builder $query, Organization|int $organization): void
    {
        $query
            ->withoutGlobalScope(OrganizationScope::class)
            ->where($this->qualifyColumn('organization_id'), $organization instanceof Organization ? $organization->id : $organization);
    }
}
