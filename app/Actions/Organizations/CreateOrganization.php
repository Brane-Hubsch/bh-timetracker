<?php

namespace App\Actions\Organizations;

use App\Actions\Holidays\AddSwedishHolidays;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateOrganization
{
    public function __construct(private readonly AddSwedishHolidays $addSwedishHolidays)
    {
        //
    }

    /**
     * Create a new organization, add the user as owner and make it their current organization. It
     * starts with the Swedish holidays of this year and the next.
     *
     * @param  array{currency?: string, default_hourly_rate?: int|null, week_starts_on?: int, timezone?: string}  $settings
     */
    public function handle(User $user, string $name, array $settings = []): Organization
    {
        return DB::transaction(function () use ($user, $name, $settings) {
            $organization = Organization::create([
                ...$settings,
                'name' => $name,
            ]);

            $organization->memberships()->create([
                'user_id' => $user->id,
                'role' => OrganizationRole::Owner,
            ]);

            $year = (int) now($organization->timezone)->format('Y');
            $this->addSwedishHolidays->handle($organization, $year);
            $this->addSwedishHolidays->handle($organization, $year + 1);

            $user->switchOrganization($organization);

            return $organization->refresh();
        });
    }
}
