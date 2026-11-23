<?php

use App\Enums\OrganizationRole;
use App\Enums\TimeEntrySource;
use App\Mcp\Servers\TimetrackerServer;
use App\Mcp\Tools\CreateClientTool;
use App\Mcp\Tools\CreateProjectTool;
use App\Mcp\Tools\CreateTimeEntriesTool;
use App\Mcp\Tools\DeleteTimeEntryTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\GetProjectStatusTool;
use App\Mcp\Tools\GetReportTool;
use App\Mcp\Tools\ListClientsTool;
use App\Mcp\Tools\ListProjectsTool;
use App\Mcp\Tools\ListTimeEntriesTool;
use App\Mcp\Tools\UpdateTimeEntryTool;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    // Wednesday 18 November 2026, 13:00 in Stockholm.
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner', 'email' => 'olivia@example.com']);
    $this->organization = $this->owner->currentOrganization;
    $this->organization->update(['name' => 'Demo AB']);
    $this->admin = User::factory()->withoutOrganization()->create(['name' => 'Adam Admin']);
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member', 'email' => 'mia@example.com', 'current_organization_id' => $this->organization->id]);
    $this->colleague = User::factory()->withoutOrganization()->create(['name' => 'Cole Colleague']);
    $this->organization->members()->attach($this->admin, ['role' => OrganizationRole::Admin->value]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->organization->members()->attach($this->colleague, ['role' => OrganizationRole::Member->value]);

    $this->acme = Client::factory()->for($this->organization)->create(['name' => 'Acme Retail AB', 'email' => 'ekonomi@acme.example']);
    $this->webbshop = Project::factory()->for($this->organization)->create(['name' => 'Webbshop', 'client_id' => $this->acme->id, 'hourly_rate' => 110000, 'estimate_seconds' => 10 * 3600]);
    $this->support = Project::factory()->for($this->organization)->create(['name' => 'Support', 'client_id' => $this->acme->id, 'hourly_rate' => 95000]);
    $this->internal = Project::factory()->for($this->organization)->create(['name' => 'Intern tid', 'is_billable' => false]);
    $this->secret = Project::factory()->for($this->organization)->private()->create(['name' => 'Hemligt']);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function mcpEntry(User $user, Project $project, string $startUtc, int $minutes): TimeEntry
{
    $start = CarbonImmutable::parse($startUtc, 'UTC');

    return TimeEntry::factory()->by($user, $project)->between($start, $start->addMinutes($minutes))->create([
        'hourly_rate' => $project->hourly_rate,
        'is_billable' => $project->is_billable,
        'description' => 'Felsökning',
    ]);
}

function foreignOrganization(): array
{
    $organization = Organization::factory()->create(['name' => 'Annat AB']);
    $owner = User::factory()->withoutOrganization()->create(['name' => 'Otto Outsider']);
    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $project = Project::factory()->for($organization)->create(['name' => 'Webbshop']);
    $entry = TimeEntry::factory()->by($owner, $project)->between(CarbonImmutable::parse('2026-11-17 08:00'), CarbonImmutable::parse('2026-11-17 10:00'))->create();

    return [$organization, $owner, $project, $entry];
}

describe('get_context', function () {
    it('describes the user, date and organization in their time zone', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(GetContextTool::class)
            ->assertOk()
            ->assertStructuredContentPaths([
                'user.name' => 'Mia Member',
                'user.timezone' => 'Europe/Stockholm',
                'now' => '2026-11-18 13:00',
                'weekday' => 'Wednesday',
                'organization.slug' => $this->organization->slug,
                'organization.role' => 'member',
                'organization.week_starts_on' => 'Monday',
                'organization.permissions.report_time_for_others' => false,
                'organization.permissions.see_rates_and_amounts' => false,
            ]);
    });

    it('refuses organizations the user is not a member of', function () {
        [$other] = foreignOrganization();

        TimetrackerServer::actingAs($this->member)
            ->tool(GetContextTool::class, ['organization' => $other->slug])
            ->assertHasErrors(['You are not a member of an organization "'.$other->slug.'"']);
    });

    it('requires authentication', function () {
        TimetrackerServer::tool(GetContextTool::class)->assertHasErrors();
    });
});

describe('clients', function () {
    it('lists clients with details for owners and names only for members', function () {
        Client::factory()->for($this->organization)->create(['name' => 'Annan kund']);

        TimetrackerServer::actingAs($this->owner)
            ->tool(ListClientsTool::class)
            ->assertOk()
            ->assertStructuredContentCount(2, 'clients')
            ->assertStructuredContentPath('clients.0.email', 'ekonomi@acme.example');

        TimetrackerServer::actingAs($this->member)
            ->tool(ListClientsTool::class)
            ->assertStructuredContentPath('clients', [['id' => $this->acme->id, 'name' => 'Acme Retail AB']]);
    });

    it('lets owners and admins create clients but not members', function () {
        TimetrackerServer::actingAs($this->admin)
            ->tool(CreateClientTool::class, ['name' => 'Nordic Health AB', 'email' => 'info@nordic.example'])
            ->assertOk()
            ->assertStructuredContentPath('created.name', 'Nordic Health AB');

        TimetrackerServer::actingAs($this->member)
            ->tool(CreateClientTool::class, ['name' => 'Inte tillåten'])
            ->assertHasErrors();

        expect(Client::query()->pluck('name')->sort()->values()->all())->toBe(['Acme Retail AB', 'Nordic Health AB']);
    });
});

describe('projects', function () {
    it('lists accessible projects with hours used and rates only for owners', function () {
        mcpEntry($this->member, $this->webbshop, '2026-11-16 08:00', 150);

        TimetrackerServer::actingAs($this->member)
            ->tool(ListProjectsTool::class)
            ->assertOk()
            ->assertStructuredContentCount(3, 'projects')
            ->assertDontSee('Hemligt')
            ->assertDontSee('hourly_rate')
            ->assertStructuredContentFragment(['name' => 'Webbshop', 'used_hours' => 2.5, 'remaining_hours' => 7.5]);

        TimetrackerServer::actingAs($this->owner)
            ->tool(ListProjectsTool::class, ['client' => 'acme'])
            ->assertStructuredContentCount(2, 'projects')
            ->assertStructuredContentFragment(['name' => 'Webbshop', 'hourly_rate' => 1100]);
    });

    it('filters projects by billable', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(ListProjectsTool::class, ['billable' => false])
            ->assertOk()
            ->assertStructuredContentCount(1, 'projects')
            ->assertStructuredContentFragment(['name' => 'Intern tid', 'billable' => false]);
    });

    it('lets owners create projects for a client by name', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(CreateProjectTool::class, ['name' => 'Kampanj', 'client' => 'Acme', 'hourly_rate' => 1250, 'estimate_hours' => 40])
            ->assertOk()
            ->assertStructuredContentPath('created.client', 'Acme Retail AB');

        $project = Project::query()->where('name', 'Kampanj')->sole();

        expect($project->client_id)->toBe($this->acme->id)
            ->and($project->hourly_rate)->toBe(125000)
            ->and($project->estimate_seconds)->toBe(40 * 3600);

        TimetrackerServer::actingAs($this->member)
            ->tool(CreateProjectTool::class, ['name' => 'Eget'])
            ->assertHasErrors();

        expect(Project::query()->where('name', 'Eget')->exists())->toBeFalse();
    });
});

describe('create_time_entries', function () {
    it('creates entries from local times and project names', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'acme webbshop', 'date' => '2026-11-17', 'start' => '13:00', 'duration' => '3', 'description' => 'Felsökning av checkout'],
                ['project' => 'Intern tid', 'date' => '2026-11-17', 'start' => '16:00', 'end' => '16:45'],
            ]])
            ->assertOk()
            ->assertStructuredContentPath('total_hours', 3.75)
            ->assertStructuredContentFragment(['date' => '2026-11-17', 'start' => '13:00', 'end' => '16:00', 'hours' => 3]);

        $entries = TimeEntry::query()->orderBy('started_at')->get();

        expect($entries)->toHaveCount(2)
            ->and($entries[0]->user_id)->toBe($this->member->id)
            ->and($entries[0]->project_id)->toBe($this->webbshop->id)
            ->and($entries[0]->started_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-17 12:00')
            ->and($entries[0]->source)->toBe(TimeEntrySource::Mcp)
            ->and($entries[0]->hourly_rate)->toBe(110000)
            ->and($entries[1]->is_billable)->toBeFalse();
    });

    it('asks which project is meant when a name is ambiguous', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'Acme', 'date' => '2026-11-17', 'start' => '08:00', 'duration' => '1'],
            ]])
            ->assertHasErrors(['The project "Acme" matches 2 projects'])
            ->assertSee('Webbshop · Acme Retail AB (id '.$this->webbshop->id.')');

        expect(TimeEntry::count())->toBe(0);
    });

    it('creates nothing when one entry is invalid', function () {
        $this->webbshop->update(['archived_at' => now()]);

        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'Support', 'date' => '2026-11-17', 'start' => '08:00', 'duration' => '1'],
                ['project' => 'Support', 'date' => '2026-11-17', 'start' => '09:00', 'duration' => 'en stund'],
            ]])
            ->assertHasErrors(['Give a duration such as']);

        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'Support', 'date' => '2026-11-17', 'start' => '08:00', 'duration' => '1'],
                ['project' => 'Webbshop', 'date' => '2026-11-17', 'start' => '09:00', 'duration' => '1'],
            ]])
            ->assertHasErrors(['No project matches "Webbshop"']);

        expect(TimeEntry::count())->toBe(0);
    });

    it('does not let members use private projects they are not assigned to', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => $this->secret->id, 'date' => '2026-11-17', 'start' => '08:00', 'duration' => '1'],
            ]])
            ->assertHasErrors(['No project with id '.$this->secret->id]);
    });

    it('lets admins report for members but not members for each other', function () {
        TimetrackerServer::actingAs($this->admin)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'Support', 'date' => '2026-11-17', 'start' => '08:00', 'duration' => '1', 'member' => 'mia@example.com'],
            ]])
            ->assertOk();

        expect(TimeEntry::sole()->user_id)->toBe($this->member->id);

        TimetrackerServer::actingAs($this->member)
            ->tool(CreateTimeEntriesTool::class, ['entries' => [
                ['project' => 'Support', 'date' => '2026-11-17', 'start' => '09:00', 'duration' => '1', 'member' => 'Cole Colleague'],
            ]])
            ->assertHasErrors(['Only owners and admins']);

        expect(TimeEntry::count())->toBe(1);
    });
});

describe('list_time_entries', function () {
    it('lists the user\'s own entries in local time by default', function () {
        mcpEntry($this->member, $this->webbshop, '2026-11-16 07:00', 90);
        mcpEntry($this->colleague, $this->webbshop, '2026-11-16 07:00', 60);
        mcpEntry($this->member, $this->webbshop, '2026-11-09 07:00', 60);

        TimetrackerServer::actingAs($this->member)
            ->tool(ListTimeEntriesTool::class)
            ->assertOk()
            ->assertStructuredContentPaths([
                'period' => ['from' => '2026-11-16', 'to' => '2026-11-22'],
                'entries.0.start' => '08:00',
                'entries.0.end' => '09:30',
                'entries.0.hours' => 1.5,
                'totals.hours' => 1.5,
            ])
            ->assertStructuredContentCount(1, 'entries')
            ->assertStructuredContentMissingPath('totals.amount');

        TimetrackerServer::actingAs($this->member)
            ->tool(ListTimeEntriesTool::class, ['period' => 'last_week'])
            ->assertStructuredContentPath('entries.0.date', '2026-11-09');

        TimetrackerServer::actingAs($this->member)
            ->tool(ListTimeEntriesTool::class, ['period' => 'all_time'])
            ->assertOk()
            ->assertStructuredContentPath('period', ['from' => null, 'to' => null])
            ->assertStructuredContentCount(2, 'entries')
            ->assertStructuredContentPath('totals.hours', 2.5);
    });

    it('lets admins list a member or everyone, but not members', function () {
        mcpEntry($this->member, $this->webbshop, '2026-11-16 07:00', 90);
        mcpEntry($this->colleague, $this->webbshop, '2026-11-17 07:00', 60);

        TimetrackerServer::actingAs($this->admin)
            ->tool(ListTimeEntriesTool::class, ['member' => 'all'])
            ->assertStructuredContentCount(2, 'entries')
            ->assertStructuredContentPath('totals.amount', 2750);

        TimetrackerServer::actingAs($this->admin)
            ->tool(ListTimeEntriesTool::class, ['member' => 'Cole'])
            ->assertStructuredContentCount(1, 'entries');

        TimetrackerServer::actingAs($this->member)
            ->tool(ListTimeEntriesTool::class, ['member' => 'Cole'])
            ->assertHasErrors(['Only owners and admins']);

        TimetrackerServer::actingAs($this->member)
            ->tool(ListTimeEntriesTool::class, ['member' => 'all'])
            ->assertHasErrors();
    });

    it('never lists another organization\'s entries', function () {
        foreignOrganization();

        TimetrackerServer::actingAs($this->owner)
            ->tool(ListTimeEntriesTool::class, ['member' => 'all'])
            ->assertStructuredContentCount(0, 'entries')
            ->assertDontSee('Otto Outsider');
    });
});

describe('update_time_entry', function () {
    it('moves an entry and keeps its duration', function () {
        $entry = mcpEntry($this->member, $this->webbshop, '2026-11-16 07:00', 90);

        TimetrackerServer::actingAs($this->member)
            ->tool(UpdateTimeEntryTool::class, ['id' => $entry->id, 'start' => '10:00', 'project' => 'Support', 'description' => 'Ändrad'])
            ->assertOk()
            ->assertStructuredContentPaths(['updated.start' => '10:00', 'updated.end' => '11:30', 'updated.project.name' => 'Support']);

        $entry->refresh();

        expect($entry->project_id)->toBe($this->support->id)
            ->and($entry->duration_seconds)->toBe(5400)
            ->and($entry->description)->toBe('Ändrad')
            ->and($entry->hourly_rate)->toBe(95000);
    });

    it('forbids changing other members\' entries and entries of other organizations', function () {
        $colleagues = mcpEntry($this->colleague, $this->webbshop, '2026-11-16 07:00', 60);
        [, , , $foreign] = foreignOrganization();

        TimetrackerServer::actingAs($this->member)
            ->tool(UpdateTimeEntryTool::class, ['id' => $colleagues->id, 'description' => 'Hack'])
            ->assertHasErrors();

        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateTimeEntryTool::class, ['id' => $foreign->id, 'description' => 'Hack'])
            ->assertHasErrors(['No time entry with id '.$foreign->id]);

        expect($colleagues->fresh()->description)->toBe('Felsökning')
            ->and(TimeEntry::query()->withoutGlobalScopes()->find($foreign->id)->description)->not->toBe('Hack');
    });
});

describe('delete_time_entry', function () {
    it('deletes the user\'s own entry', function () {
        $entry = mcpEntry($this->member, $this->webbshop, '2026-11-16 07:00', 60);

        TimetrackerServer::actingAs($this->member)
            ->tool(DeleteTimeEntryTool::class, ['id' => $entry->id])
            ->assertOk()
            ->assertStructuredContentPath('deleted.id', $entry->id);

        expect($entry->fresh()->trashed())->toBeTrue();
    });

    it('forbids deleting other members\' entries and other organizations\' entries', function () {
        $colleagues = mcpEntry($this->colleague, $this->webbshop, '2026-11-16 07:00', 60);
        [, , , $foreign] = foreignOrganization();

        TimetrackerServer::actingAs($this->member)->tool(DeleteTimeEntryTool::class, ['id' => $colleagues->id])->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)->tool(DeleteTimeEntryTool::class, ['id' => $foreign->id])->assertHasErrors();

        expect($colleagues->fresh()->trashed())->toBeFalse()
            ->and(TimeEntry::query()->withoutGlobalScopes()->find($foreign->id)->trashed())->toBeFalse();
    });
});

describe('reports', function () {
    beforeEach(function () {
        mcpEntry($this->member, $this->webbshop, '2026-11-16 07:00', 120);
        mcpEntry($this->colleague, $this->support, '2026-11-17 07:00', 60);
        mcpEntry($this->member, $this->internal, '2026-11-17 09:00', 60);
    });

    it('gives owners the team report with amounts', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(GetReportTool::class, ['group_by' => 'client', 'then_by' => 'project'])
            ->assertOk()
            ->assertStructuredContentPaths([
                'period' => ['from' => '2026-11-01', 'to' => '2026-11-30'],
                'scope' => 'team',
                'currency' => 'SEK',
                'totals' => ['hours' => 4, 'billable_hours' => 3, 'amount' => 3150],
                'groups.0.client' => 'Acme Retail AB',
                'groups.0.children.0.project' => 'Webbshop',
            ]);
    });

    it('gives members only their own time without amounts', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(GetReportTool::class, ['group_by' => 'member', 'members' => ['Cole']])
            ->assertHasErrors(['Only owners and admins']);

        TimetrackerServer::actingAs($this->member)
            ->tool(GetReportTool::class, ['group_by' => 'day', 'from' => '2026-11-16', 'to' => '2026-11-17'])
            ->assertOk()
            ->assertStructuredContentPaths([
                'scope' => 'own time only',
                'currency' => null,
                'totals' => ['hours' => 3, 'billable_hours' => 2],
                'groups.0.day' => '2026-11-16',
            ]);
    });

    it('reports estimate status per project', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(GetProjectStatusTool::class, ['project' => 'Webbshop'])
            ->assertOk()
            ->assertStructuredContentPath('projects', [[
                'id' => $this->webbshop->id,
                'name' => 'Webbshop',
                'client' => 'Acme Retail AB',
                'estimate_hours' => 10,
                'used_hours' => 2,
                'billable_hours' => 2,
                'remaining_hours' => 8,
                'percent_used' => 20,
            ]]);
    });

    it('gives the working days left and the hours needed per working day', function () {
        $this->webbshop->update(['starts_on' => '2026-11-01', 'ends_on' => '2026-11-27']);

        // Wednesday 18 – Friday 27 November: 8 working days for the 8 hours left.
        TimetrackerServer::actingAs($this->member)
            ->tool(GetProjectStatusTool::class, ['project' => 'Webbshop'])
            ->assertOk()
            ->assertStructuredContentPaths([
                'projects.0.starts_on' => '2026-11-01',
                'projects.0.ends_on' => '2026-11-27',
                'projects.0.working_days_left' => 8,
                'projects.0.hours_per_working_day' => 1,
            ]);
    });
});
