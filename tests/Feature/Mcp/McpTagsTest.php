<?php

use App\Enums\OrganizationRole;
use App\Mcp\Servers\TimetrackerServer;
use App\Mcp\Tools\CreateTimeEntriesTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\GetReportTool;
use App\Mcp\Tools\ListTimeEntriesTool;
use App\Mcp\Tools\UpdateTimeEntryTool;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create(['name' => 'Webbshop']);
    $this->meeting = Tag::factory()->for($this->organization)->create(['name' => 'Möte']);
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('lists the organization\'s tags in the context', function () {
    Tag::factory()->create(['name' => 'Hemlig']);

    TimetrackerServer::actingAs($this->member)
        ->tool(GetContextTool::class)
        ->assertOk()
        ->assertStructuredContentPath('tags', ['Möte']);
});

it('creates entries with tags, reusing existing ones and creating new ones', function () {
    TimetrackerServer::actingAs($this->member)
        ->tool(CreateTimeEntriesTool::class, ['entries' => [
            ['project' => 'Webbshop', 'date' => '2026-11-18', 'start' => '09:00', 'duration' => '1', 'tags' => ['möte', 'Planering']],
        ]])
        ->assertOk()
        ->assertStructuredContentPath('created.0.tags', ['Möte', 'Planering']);

    expect(Tag::query()->forOrganization($this->organization)->count())->toBe(2);
});

it('replaces, keeps or clears tags when updating', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)->create();
    $entry->tags()->attach($this->meeting);

    TimetrackerServer::actingAs($this->member)
        ->tool(UpdateTimeEntryTool::class, ['id' => $entry->id, 'description' => 'Ny text'])
        ->assertOk()
        ->assertStructuredContentPath('updated.tags', ['Möte']);

    TimetrackerServer::actingAs($this->member)
        ->tool(UpdateTimeEntryTool::class, ['id' => $entry->id, 'tags' => ['Buggfix']])
        ->assertOk()
        ->assertStructuredContentPath('updated.tags', ['Buggfix']);

    TimetrackerServer::actingAs($this->member)
        ->tool(UpdateTimeEntryTool::class, ['id' => $entry->id, 'tags' => []])
        ->assertOk();

    expect($entry->tags()->count())->toBe(0);
});

it('shows tags on listed entries', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)
        ->between(CarbonImmutable::parse('2026-11-17 08:00'), CarbonImmutable::parse('2026-11-17 09:00'))
        ->create();
    $entry->tags()->attach($this->meeting);

    TimetrackerServer::actingAs($this->member)
        ->tool(ListTimeEntriesTool::class, ['from' => '2026-11-16', 'to' => '2026-11-18'])
        ->assertOk()
        ->assertStructuredContentPath('entries.0.tags', ['Möte']);
});

it('filters and groups the report by tag', function () {
    $tagged = TimeEntry::factory()->by($this->owner, $this->project)
        ->between(CarbonImmutable::parse('2026-11-16 08:00'), CarbonImmutable::parse('2026-11-16 09:00'))
        ->create();
    $tagged->tags()->attach($this->meeting);
    TimeEntry::factory()->by($this->owner, $this->project)
        ->between(CarbonImmutable::parse('2026-11-16 10:00'), CarbonImmutable::parse('2026-11-16 12:00'))
        ->create();

    TimetrackerServer::actingAs($this->owner)
        ->tool(GetReportTool::class, ['tags' => ['möte']])
        ->assertOk()
        ->assertStructuredContentPath('totals.hours', 1);

    TimetrackerServer::actingAs($this->owner)
        ->tool(GetReportTool::class, ['group_by' => 'tag'])
        ->assertOk()
        ->assertStructuredContentPath('groups.0.tag', 'Utan tagg')
        ->assertStructuredContentPath('groups.1.tag', 'Möte');
});

it('does not accept another organization\'s tag in the report filter', function () {
    $foreign = Tag::factory()->create(['name' => 'Hemlig']);

    TimetrackerServer::actingAs($this->owner)
        ->tool(GetReportTool::class, ['tags' => [$foreign->id]])
        ->assertHasErrors(["No tag with id {$foreign->id} that you can access."]);
});
