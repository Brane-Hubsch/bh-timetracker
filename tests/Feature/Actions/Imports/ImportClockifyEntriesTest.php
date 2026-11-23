<?php

use App\Actions\Imports\ImportClockifyEntries;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Enums\TimeEntrySource;
use App\Models\Client;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Imports\ClockifyCsv;
use App\Services\Imports\ClockifyImportPlan;
use App\Support\CurrentOrganization;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Olivia Owner', 'email' => 'olivia@example.com']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Anna Andersson', 'email' => 'anna@example.com', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    app(CurrentOrganization::class)->set($this->organization);

    $this->import = fn (string $csv, array $members = [], array $billable = [], array $rates = []) => app(ImportClockifyEntries::class)
        ->handle($this->organization, $this->owner, ClockifyCsv::fromString($csv), $members, $billable, $rates);
});

it('creates clients, projects and entries, matching members on email', function () {
    $result = ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'ANNA@example.com', '11-30-2026', '9:00', '11-30-2026', '17:00', 'installer app', 'Utveckling', 'SOPF'),
        clockifyRow('Kontoret', '', 'olivia@example.com', '11-04-2026', '21:30', '11-05-2026', '0:00'),
    ]), billable: [ClockifyImportPlan::projectKey(null, 'Kontoret') => false]);

    expect($result)->toMatchArray(['created' => 2, 'seconds' => 8 * 3600 + 9000, 'clientsCreated' => 1, 'projectsCreated' => 2, 'skipped' => []]);

    $webbshop = Project::query()->where('name', 'Webbshop')->sole();
    $kontoret = Project::query()->where('name', 'Kontoret')->sole();
    expect($webbshop->client->name)->toBe('Acme')
        ->and($webbshop->is_billable)->toBeTrue()
        ->and($webbshop->visibility)->toBe(ProjectVisibility::Public)
        ->and($kontoret->client_id)->toBeNull()
        ->and($kontoret->is_billable)->toBeFalse();

    $entry = TimeEntry::query()->with('tags')->where('user_id', $this->member->id)->sole();
    expect($entry->project_id)->toBe($webbshop->id)
        ->and($entry->description)->toBe('Utveckling – installer app')
        ->and($entry->tagNames())->toBe(['SOPF'])
        ->and($entry->source)->toBe(TimeEntrySource::Import)
        ->and($entry->is_billable)->toBeTrue()
        // 09:00 in Stockholm (CET) is 08:00 UTC.
        ->and($entry->started_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-30 08:00');

    // Crosses midnight: a 2.5 hour entry, not billable like its project.
    $late = TimeEntry::query()->where('user_id', $this->owner->id)->sole();
    expect($late->duration_seconds)->toBe(9000)
        ->and($late->is_billable)->toBeFalse();
});

it('reuses existing clients and projects by name, ignoring case', function () {
    $client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    $project = Project::factory()->for($this->organization)->for($client)->create(['name' => 'Webbshop', 'is_billable' => false]);

    $result = ($this->import)(clockifyCsv([
        clockifyRow('webbshop', 'ACME', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]));

    expect($result)->toMatchArray(['created' => 1, 'clientsCreated' => 0, 'projectsCreated' => 0])
        ->and(TimeEntry::query()->sole()->project_id)->toBe($project->id)
        ->and(TimeEntry::query()->sole()->is_billable)->toBeFalse();
});

it('puts time on a chosen member or skips users who are not members', function () {
    $result = ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'dennis@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00', user: 'Dennis'),
        clockifyRow('Webbshop', 'Acme', 'isak@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00', user: 'Isak'),
    ]), members: ['dennis@example.com' => $this->member->id]);

    expect($result['created'])->toBe(1)
        ->and($result['skipped'])->toHaveCount(1)
        ->and($result['skipped'][0]['reason'])->toContain('isak@example.com')
        ->and(TimeEntry::query()->sole()->user_id)->toBe($this->member->id);
});

it('skips entries longer than 24 hours, on archived projects and that already exist', function () {
    $archived = Project::factory()->for($this->organization)->archived()->create(['name' => 'Gammalt']);
    $csv = clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '03-02-2026', '8:30', '03-05-2026', '0:30'),
        clockifyRow('Gammalt', '', 'anna@example.com', '11-30-2026', '13:00', '11-30-2026', '14:00'),
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]);

    $first = ($this->import)($csv);

    expect($first['created'])->toBe(1)
        ->and(array_column($first['skipped'], 'line'))->toBe([3, 4, 5])
        ->and($first['skipped'][0]['reason'])->toContain('24')
        ->and(TimeEntry::query()->where('project_id', $archived->id)->exists())->toBeFalse();

    // Importing the same file again adds nothing.
    expect(fn () => ($this->import)($csv))->toThrow(ValidationException::class)
        ->and(TimeEntry::query()->count())->toBe(1);
});

it('skips private projects the member is not assigned to', function () {
    Project::factory()->for($this->organization)->private()->create(['name' => 'Hemligt']);

    $result = ($this->import)(clockifyCsv([
        clockifyRow('Hemligt', '', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Hemligt', '', 'olivia@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]));

    expect($result['created'])->toBe(1)
        ->and(TimeEntry::query()->sole()->user_id)->toBe($this->owner->id);
});

it('never uses another organization\'s projects, clients or members', function () {
    $outsider = User::factory()->create(['email' => 'otto@example.com']);
    $otherOrganization = $outsider->currentOrganization;
    $foreignClient = Client::factory()->for($otherOrganization)->create(['name' => 'Acme']);
    $foreignProject = Project::factory()->for($otherOrganization)->for($foreignClient)->create(['name' => 'Webbshop']);

    // The outsider can't be chosen for Anna's time, and isn't matched on email: nothing to import.
    expect(fn () => ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Webbshop', 'Acme', 'otto@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]), members: ['anna@example.com' => $outsider->id]))->toThrow(ValidationException::class);

    expect(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and($foreignProject->fresh()->name)->toBe('Webbshop');
});

it('creates its own client and project when another organization has the same names', function () {
    $outsider = User::factory()->create();
    $foreignClient = Client::factory()->for($outsider->currentOrganization)->create(['name' => 'Acme']);
    $foreignProject = Project::factory()->for($outsider->currentOrganization)->for($foreignClient)->create(['name' => 'Webbshop']);

    ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]));

    $entry = TimeEntry::query()->sole();
    expect($entry->organization_id)->toBe($this->organization->id)
        ->and($entry->project_id)->not->toBe($foreignProject->id)
        ->and($entry->project->organization_id)->toBe($this->organization->id)
        ->and($entry->project->client->organization_id)->toBe($this->organization->id)
        ->and(TimeEntry::query()->withoutGlobalScopes()->where('project_id', $foreignProject->id)->exists())->toBeFalse();
});

it('gives each member the chosen rate and saves changed rates on the project', function () {
    $this->organization->update(['default_hourly_rate' => 100000]);
    $key = ClockifyImportPlan::projectKey('Acme', 'Webbshop');

    ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Webbshop', 'Acme', 'olivia@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]), rates: [
        ClockifyImportPlan::rateKey($key, $this->member->id) => 125000,
        ClockifyImportPlan::rateKey($key, $this->owner->id) => null,
    ]);

    $project = Project::query()->where('name', 'Webbshop')->sole();
    expect(TimeEntry::query()->where('user_id', $this->member->id)->sole()->hourly_rate)->toBe(125000)
        ->and(TimeEntry::query()->where('user_id', $this->owner->id)->sole()->hourly_rate)->toBe(100000)
        // Only the changed rate is saved, so later time gets it too.
        ->and(ProjectMember::query()->where('project_id', $project->id)->pluck('hourly_rate', 'user_id')->all())->toBe([$this->member->id => 125000]);
});

it('ignores rates on projects that are not billable', function () {
    $key = ClockifyImportPlan::projectKey(null, 'Kontoret');

    ($this->import)(clockifyCsv([
        clockifyRow('Kontoret', '', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]), billable: [$key => false], rates: [ClockifyImportPlan::rateKey($key, $this->member->id) => 125000]);

    expect(ProjectMember::query()->exists())->toBeFalse()
        ->and(TimeEntry::query()->sole()->hourly_rate)->toBeNull();
});

it('updates the rate and billable setting of entries an earlier import created, never time reported in the app', function () {
    $client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    $project = Project::factory()->for($this->organization)->for($client)->create(['name' => 'Webbshop', 'is_billable' => true]);
    $reported = TimeEntry::factory()->by($this->owner, $project)->between('2026-11-30 08:00', '2026-11-30 09:00')->create(['hourly_rate' => 500, 'is_billable' => false]);
    $csv = clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Webbshop', 'Acme', 'olivia@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]);

    ($this->import)($csv);
    $imported = TimeEntry::query()->where('user_id', $this->member->id)->sole();
    expect($imported->hourly_rate)->toBeNull();

    // Without updating, there is nothing left to import.
    expect(fn () => ($this->import)($csv))->toThrow(ValidationException::class);

    // E.g. the project was not billable at the first import.
    $imported->update(['is_billable' => false]);
    $rates = [ClockifyImportPlan::rateKey('acme|webbshop', $this->member->id) => 125000, ClockifyImportPlan::rateKey('acme|webbshop', $this->owner->id) => 125000];
    $result = app(ImportClockifyEntries::class)->handle($this->organization, $this->owner, ClockifyCsv::fromString($csv), [], [], $rates, updateExisting: true);

    expect($result)->toMatchArray(['created' => 0, 'updated' => 1])
        ->and($imported->fresh()->hourly_rate)->toBe(125000)
        ->and($imported->fresh()->is_billable)->toBeTrue()
        ->and($reported->fresh()->hourly_rate)->toBe(500)
        ->and($reported->fresh()->is_billable)->toBeFalse()
        ->and(TimeEntry::query()->count())->toBe(2);
});

it('puts time on an invited person, adding them as a member before they accept', function () {
    $this->organization->update(['default_hourly_rate' => 90000]);
    $invitation = OrganizationInvitation::factory()->for($this->organization)->create(['email' => 'Dennis@example.com', 'invited_by' => $this->owner->id]);

    $result = ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'dennis@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00', user: 'Dennis Dahl'),
    ]));

    $dennis = User::query()->where('email', 'dennis@example.com')->sole();
    expect($result['created'])->toBe(1)
        ->and($dennis->name)->toBe('Dennis Dahl')
        ->and($dennis->hasVerifiedEmail())->toBeFalse()
        ->and($dennis->current_organization_id)->toBe($this->organization->id)
        ->and($dennis->organizationRole($this->organization))->toBe(OrganizationRole::Member)
        ->and($invitation->fresh()->isPending())->toBeTrue()
        ->and(TimeEntry::query()->sole()->user_id)->toBe($dennis->id)
        ->and(TimeEntry::query()->sole()->hourly_rate)->toBe(90000);
});

it('puts time on an invitation chosen by hand, using the invited person\'s existing account', function () {
    $otto = User::factory()->create(['email' => 'otto@example.com']);
    $otherOrganization = $otto->currentOrganization;
    $invitation = OrganizationInvitation::factory()->for($this->organization)->create(['email' => 'otto@example.com', 'invited_by' => $this->owner->id]);
    $key = ClockifyImportPlan::projectKey('Acme', 'Webbshop');

    ($this->import)(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'otto.private@example.net', '11-30-2026', '9:00', '11-30-2026', '10:00', user: 'Otto'),
    ]), members: ['otto.private@example.net' => ClockifyImportPlan::invitationMemberId($invitation->id)], rates: [
        ClockifyImportPlan::rateKey($key, ClockifyImportPlan::invitationMemberId($invitation->id)) => 110000,
    ]);

    expect(User::query()->where('email', 'otto@example.com')->count())->toBe(1)
        ->and($otto->fresh()->current_organization_id)->toBe($otherOrganization->id)
        ->and($otto->organizationRole($this->organization))->toBe(OrganizationRole::Member)
        ->and(TimeEntry::query()->sole()->user_id)->toBe($otto->id)
        // The rate chosen for the invitation is saved for the member.
        ->and(TimeEntry::query()->sole()->hourly_rate)->toBe(110000);
});

it('never uses expired invitations, other organizations\' invitations or private projects the invited person can\'t see', function () {
    $expired = OrganizationInvitation::factory()->for($this->organization)->expired()->create(['email' => 'eva@example.com', 'invited_by' => $this->owner->id]);
    $foreign = OrganizationInvitation::factory()->create(['email' => 'fia@example.com']);
    $member = OrganizationInvitation::factory()->for($this->organization)->create(['email' => 'gus@example.com', 'invited_by' => $this->owner->id]);
    $admin = OrganizationInvitation::factory()->for($this->organization)->create(['email' => 'hal@example.com', 'role' => OrganizationRole::Admin, 'invited_by' => $this->owner->id]);
    Project::factory()->for($this->organization)->private()->create(['name' => 'Hemligt']);

    $result = ($this->import)(clockifyCsv([
        clockifyRow('Hemligt', '', 'eva@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Hemligt', '', 'fia@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Hemligt', '', 'gus@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
        clockifyRow('Hemligt', '', 'hal@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00'),
    ]), members: [
        'eva@example.com' => ClockifyImportPlan::invitationMemberId($expired->id),
        'fia@example.com' => ClockifyImportPlan::invitationMemberId($foreign->id),
    ]);

    expect($result['created'])->toBe(1)
        ->and(array_column($result['skipped'], 'line'))->toBe([2, 3, 4])
        ->and($result['skipped'][2]['reason'])->toBe(__(':name is not assigned to this project.', ['name' => 'Anna Andersson']))
        ->and(TimeEntry::query()->sole()->user->email)->toBe('hal@example.com')
        ->and(User::query()->whereIn('email', ['eva@example.com', 'fia@example.com', 'gus@example.com'])->exists())->toBeFalse()
        ->and($member->fresh()->isPending())->toBeTrue();
});
