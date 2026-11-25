<?php

use App\Enums\OrganizationRole;
use App\Enums\TimeEntrySource;
use App\Mcp\Servers\TimetrackerServer;
use App\Mcp\Tools\DiscardTimerTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\StartTimerTool;
use App\Mcp\Tools\StopTimerTool;
use App\Models\Project;
use App\Models\RunningTimer;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    // Wednesday 25 November 2026, 10:30 in Stockholm.
    CarbonImmutable::setTestNow('2026-11-25 09:30:00');

    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->webbshop = Project::factory()->for($this->organization)->create(['name' => 'Webbshop']);
    $this->intern = Project::factory()->for($this->organization)->create(['name' => 'Intern tid']);
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('starts a timer, shows it in the context and stops it as an entry', function () {
    TimetrackerServer::actingAs($this->member)
        ->tool(StartTimerTool::class, ['project' => 'Webbshop', 'description' => 'Kodning', 'start' => '10:00'])
        ->assertOk()
        ->assertStructuredContentPaths([
            'started.project.name' => 'Webbshop',
            'started.started' => '2026-11-25 10:00',
            'started.running_hours' => 0.5,
        ]);

    TimetrackerServer::actingAs($this->member)
        ->tool(GetContextTool::class)
        ->assertStructuredContentPaths([
            'timer.project.name' => 'Webbshop',
            'organization.timer_enabled' => true,
        ]);

    CarbonImmutable::setTestNow('2026-11-25 11:00:00');
    TimetrackerServer::actingAs($this->member)
        ->tool(StopTimerTool::class)
        ->assertOk()
        ->assertStructuredContentPaths([
            'saved.start' => '10:00',
            'saved.end' => '12:00',
            'saved.hours' => 2,
            'saved.description' => 'Kodning',
            'saved.source' => 'mcp',
        ]);

    expect(RunningTimer::query()->count())->toBe(0)
        ->and(TimeEntry::query()->sole()->source)->toBe(TimeEntrySource::Mcp);
});

it('needs a project to stop, which can be given when stopping, with an end time', function () {
    TimetrackerServer::actingAs($this->member)->tool(StartTimerTool::class)->assertOk();

    TimetrackerServer::actingAs($this->member)->tool(StopTimerTool::class)->assertHasErrors(['projekt']);

    TimetrackerServer::actingAs($this->member)
        ->tool(StopTimerTool::class, ['project' => 'Intern tid', 'end' => '10:45'])
        ->assertOk()
        ->assertStructuredContentPaths(['saved.project.name' => 'Intern tid', 'saved.end' => '10:45']);
});

it('saves the running timer when another one starts', function () {
    TimetrackerServer::actingAs($this->member)->tool(StartTimerTool::class, ['project' => 'Webbshop', 'start' => '09:00'])->assertOk();

    TimetrackerServer::actingAs($this->member)
        ->tool(StartTimerTool::class, ['project' => 'Intern tid'])
        ->assertOk()
        ->assertStructuredContentPath('saved_previous_timer', true);

    expect(TimeEntry::query()->sole()->project_id)->toBe($this->webbshop->id)
        ->and(RunningTimer::query()->sole()->project_id)->toBe($this->intern->id);
});

it('discards the timer, and refuses when none runs or the timer is turned off', function () {
    TimetrackerServer::actingAs($this->member)->tool(StartTimerTool::class, ['project' => 'Webbshop'])->assertOk();
    TimetrackerServer::actingAs($this->member)->tool(DiscardTimerTool::class)->assertOk()->assertStructuredContentPath('discarded.project.name', 'Webbshop');

    TimetrackerServer::actingAs($this->member)->tool(StopTimerTool::class)->assertHasErrors(['No timer is running.']);
    TimetrackerServer::actingAs($this->member)->tool(DiscardTimerTool::class)->assertHasErrors(['No timer is running.']);

    $this->organization->update(['timer_enabled' => false]);
    TimetrackerServer::actingAs($this->member)->tool(StartTimerTool::class)->assertHasErrors();
    expect(RunningTimer::query()->count())->toBe(0)
        ->and(TimeEntry::query()->count())->toBe(0);
});

it('only touches the user\'s own timer and their organization\'s projects', function () {
    RunningTimer::factory()->by($this->owner, $this->webbshop)->create();
    $foreign = Project::factory()->create(['name' => 'Främmande']);

    TimetrackerServer::actingAs($this->member)->tool(StopTimerTool::class)->assertHasErrors(['No timer is running.']);
    TimetrackerServer::actingAs($this->member)->tool(StartTimerTool::class, ['project' => (string) $foreign->id])->assertHasErrors();

    expect(RunningTimer::query()->sole()->user_id)->toBe($this->owner->id);
});
