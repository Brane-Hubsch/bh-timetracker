<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateTeamMember
{
    public function __construct(
        private readonly UpdateOrganizationMemberRole $updateRole,
        private readonly UpdateOrganizationMemberRate $updateRate,
    ) {}

    /** @param array{week_starts_on: ?int, working_days: list<int>, workday_seconds: ?int} $schedule */
    public function handle(Organization $organization, User $user, array $schedule, ?OrganizationRole $role, bool $setRate, ?int $rate): Membership
    {
        return DB::transaction(function () use ($organization, $user, $schedule, $role, $setRate, $rate) {
            $membership = $organization->memberships()->where('user_id', $user->id)
                ->whereNull('deactivated_at')
                ->lockForUpdate()
                ->firstOrFail();

            if ($role !== null && $role !== $membership->role) {
                $this->updateRole->handle($organization, $user, $role);
            }

            if ($setRate) {
                $this->updateRate->handle($organization, $user, $rate);
            }

            $membership->update($schedule);

            return $membership->refresh();
        });
    }
}
