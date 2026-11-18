<?php

namespace Database\Seeders;

use App\Actions\Organizations\CreateOrganization;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed a demo organization for local development.
     *
     * Log in as owner@example.com / admin@example.com / member@example.com (password: "password").
     * Includes demo clients and projects; time entries are added in phase 3.
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

        $this->seedClientsAndProjects($organization);
    }

    /**
     * Demo clients and projects (time entries are added in phase 3).
     */
    private function seedClientsAndProjects(Organization $organization): void
    {
        $member = User::where('email', 'member@example.com')->sole();

        $acme = Client::factory()->for($organization)->create(['name' => 'Acme Retail AB', 'email' => 'ekonomi@acme.example']);
        $nordic = Client::factory()->for($organization)->create(['name' => 'Nordic Health AB']);
        Client::factory()->for($organization)->archived()->create(['name' => 'Gamla Kunden AB']);

        $projects = [
            ['client' => $acme, 'name' => 'Webbshop', 'code' => 'ACME-01', 'estimate' => 120, 'rate' => 1_100_00],
            ['client' => $acme, 'name' => 'Support', 'code' => 'ACME-SUP', 'estimate' => null, 'rate' => null],
            ['client' => $nordic, 'name' => 'Patientportal', 'code' => 'NH-01', 'estimate' => 300, 'rate' => 1_250_00, 'private' => true],
            ['client' => null, 'name' => 'Intern tid', 'code' => 'INT', 'estimate' => null, 'rate' => null, 'billable' => false],
        ];

        foreach ($projects as $index => $attributes) {
            $project = Project::factory()->for($organization)->create([
                'client_id' => $attributes['client']?->id,
                'name' => $attributes['name'],
                'code' => $attributes['code'],
                'color' => Project::COLORS[$index],
                'estimate_seconds' => $attributes['estimate'] === null ? null : $attributes['estimate'] * 3600,
                'hourly_rate' => $attributes['rate'],
                'is_billable' => $attributes['billable'] ?? true,
                'visibility' => ($attributes['private'] ?? false) ? ProjectVisibility::Private : ProjectVisibility::Public,
            ]);

            if ($attributes['private'] ?? false) {
                $project->members()->attach($member, ['hourly_rate' => 1_000_00]);
            }
        }

        Project::factory()->for($organization)->archived()->create(['name' => 'Avslutat projekt', 'client_id' => $acme->id]);
    }
}
