<?php

namespace Database\Seeders;

use App\Actions\Organizations\CreateOrganization;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use App\Support\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed a demo organization for local development.
     *
     * Log in as owner@example.com / admin@example.com / member@example.com (password: "password").
     * Includes demo clients, projects and a few weeks of time entries.
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

        $organization->update(['team_enabled' => true]);

        $createOrganization->handle($owner, 'Sidoprojekt HB');
        $owner->switchOrganization($organization);

        $this->seedClientsAndProjects($organization);
        $this->seedTimeEntries($organization);
    }

    /**
     * About three weeks of working days for every member, through the real action (rates snapshotted).
     */
    private function seedTimeEntries(Organization $organization): void
    {
        $createTimeEntry = app(CreateTimeEntry::class);
        app(CurrentOrganization::class)->set($organization);
        $descriptions = ['Utveckling', 'Möte med kund', 'Felsökning', 'Planering', 'Kodgranskning', 'Support'];
        mt_srand(47);

        foreach ($organization->members as $member) {
            $projects = Project::query()->forOrganization($organization)->active()->accessibleBy($member, $organization)->get();
            $day = CarbonImmutable::now($member->timezone)->startOfWeek()->subWeeks(2);

            while ($day->isBefore(CarbonImmutable::now($member->timezone)->startOfDay())) {
                if (! $day->isWeekend()) {
                    $start = $day->setTime(8, 0);

                    foreach ([3, 1.5, 2.5] as $hours) {
                        $end = $start->addMinutes((int) ($hours * 60));
                        $createTimeEntry->handle($organization, new TimeEntryData(
                            userId: $member->id,
                            projectId: $projects->random()->id,
                            startedAt: $start->utc(),
                            endedAt: $end->utc(),
                            description: $descriptions[array_rand($descriptions)],
                        ));
                        $start = $end->addMinutes(30);
                    }
                }

                $day = $day->addDay();
            }
        }
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
