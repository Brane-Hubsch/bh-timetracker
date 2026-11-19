<?php

namespace App\Services\Reports;

use App\Enums\OrganizationPermission;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * What a report covers. Dates are local dates in the viewer's time zone (`to` inclusive, null =
 * unbounded). Viewers without ManageTeamTime only ever see their own time, whatever member filter
 * is passed, and amounts are only calculated for viewers with ViewRates.
 */
final readonly class ReportFilters
{
    /** The viewer's role in the organization, resolved once (checked for every report row). */
    private ?OrganizationRole $role;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<int, int>  $clientIds
     * @param  array<int, int>  $projectIds
     * @param  array<int, int>  $tagIds  Entries with any of these tags.
     */
    public function __construct(
        public Organization $organization,
        public User $viewer,
        public ?CarbonImmutable $from,
        public ?CarbonImmutable $to,
        public array $userIds = [],
        public array $clientIds = [],
        public array $projectIds = [],
        public ?bool $billable = null,
        public array $tagIds = [],
    ) {
        $this->role = $viewer->organizationRole($organization);
    }

    public function timezone(): string
    {
        return $this->viewer->timezone;
    }

    public function canViewTeam(): bool
    {
        return $this->role?->hasPermission(OrganizationPermission::ManageTeamTime) ?? false;
    }

    public function canViewAmounts(): bool
    {
        return $this->role?->hasPermission(OrganizationPermission::ViewRates) ?? false;
    }

    /**
     * Start of the period as a UTC instant, or null when unbounded.
     */
    public function startsAt(): ?CarbonImmutable
    {
        return $this->from ? CarbonImmutable::parse($this->from->toDateString(), $this->timezone())->utc() : null;
    }

    /**
     * End of the period (exclusive) as a UTC instant, or null when unbounded.
     */
    public function endsBefore(): ?CarbonImmutable
    {
        return $this->to ? CarbonImmutable::parse($this->to->toDateString(), $this->timezone())->addDay()->utc() : null;
    }
}
