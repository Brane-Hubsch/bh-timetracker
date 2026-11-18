<?php

namespace Database\Seeders;

use App\Actions\Organizations\CreateOrganization;
use App\Enums\OrganizationRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed a demo organization for local development.
     *
     * Log in as owner@example.com / admin@example.com / member@example.com (password: "password").
     * Clients, projects and time entries are added to the demo data in later phases.
     */
    public function run(CreateOrganization $createOrganization): void
    {
        $owner = User::factory()->withoutOrganization()->create([
            'name' => 'Olivia Ägare',
            'email' => 'owner@example.com',
        ]);

        $organization = $createOrganization->handle($owner, 'Demo AB', [
            'default_hourly_rate' => 950_00,
        ]);

        foreach ([OrganizationRole::Admin, OrganizationRole::Member] as $role) {
            $user = User::factory()->withoutOrganization()->create([
                'name' => $role === OrganizationRole::Admin ? 'Adam Admin' : 'Maja Medlem',
                'email' => "{$role->value}@example.com",
            ]);

            $organization->members()->attach($user, ['role' => $role->value]);
            $user->switchOrganization($organization);
        }

        $createOrganization->handle($owner, 'Sidoprojekt HB');
        $owner->switchOrganization($organization);
    }
}
