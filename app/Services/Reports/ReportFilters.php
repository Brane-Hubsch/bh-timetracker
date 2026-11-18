<?php

namespace App\Services\Reports;

use App\Enums\OrganizationPermission;
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
    /**
     * @param  array<int, int>  $userIds
     * @param  array<int, int>  $clientIds
     * @param  array<int, int>  $projectIds
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
    ) {
        //
    }

    public function timezone(): string
    {
        return $this->viewer->timezone;
    }

    public function canViewTeam(): bool
    {
        return $this->viewer->hasOrganizationPermission($this->organization, OrganizationPermission::ManageTeamTime);
    }

    public function canViewAmounts(): bool
    {
        return $this->viewer->hasOrganizationPermission($this->organization, OrganizationPermission::ViewRates);
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
