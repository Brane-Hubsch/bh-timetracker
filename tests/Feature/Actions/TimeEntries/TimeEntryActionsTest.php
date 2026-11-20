<?php

use App\Actions\TimeEntries\CreateTimeEntries;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Actions\TimeEntries\DeleteTimeEntry;
use App\Actions\TimeEntries\RepriceTimeEntry;
use App\Actions\TimeEntries\RestoreTimeEntry;
use App\Actions\TimeEntries\UpdateTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->organization->update(['default_hourly_rate' => 80000]);
    $this->member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create(['hourly_rate' => 100000]);
});

function entryData(User $user, Project $project, string $start = '2026-11-16 08:00', string $end = '2026-11-16 10:30', array $overrides = []): TimeEntryData
{
    return new TimeEntryData(
        userId: $overrides['userId'] ?? $user->id,
        projectId: $overrides['projectId'] ?? $project->id,
        startedAt: CarbonImmutable::parse($start, 'UTC'),
        endedAt: CarbonImmutable::parse($end, 'UTC'),
        description: $overrides['description'] ?? 'Work',
        isBillable: $overrides['isBillable'] ?? null,
    );
}

it('creates an entry with duration, inherited billable and snapshotted rate', function () {
    $entry = app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project));

    expect($entry->duration_seconds)->toBe(9000)
        ->and($entry->is_billable)->toBeTrue()
        ->and($entry->hourly_rate)->toBe(100000)
        ->and($entry->organization_id)->toBe($this->organization->id)
        ->and($entry->started_at->utc()->toDateTimeString())->toBe('2026-11-16 08:00:00');
});

it('inherits non-billable from the project but allows overriding', function () {
    $internal = Project::factory()->for($this->organization)->create(['is_billable' => false]);

    expect(app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $internal))->is_billable)->toBeFalse()
        ->and(app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $internal, overrides: ['isBillable' => true]))->is_billable)->toBeTrue();
});

it('allows entries over midnight', function () {
    $entry = app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project, '2026-11-16 22:00', '2026-11-17 01:00'));

    expect($entry->duration_seconds)->toBe(3 * 3600);
});

it('rejects invalid periods', function (string $start, string $end) {
    app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project, $start, $end));
})->with([
    'end before start' => ['2026-11-16 10:00', '2026-11-16 09:00'],
    'zero length' => ['2026-11-16 10:00', '2026-11-16 10:00'],
    'over 24 hours' => ['2026-11-16 08:00', '2026-11-17 08:01'],
])->throws(ValidationException::class);

it('rejects archived projects and projects of archived clients', function () {
    $archived = Project::factory()->for($this->organization)->archived()->create();
    $client = Client::factory()->for($this->organization)->archived()->create();
    $ofArchivedClient = Project::factory()->for($this->organization)->create(['client_id' => $client->id]);

    expect(fn () => app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $archived)))->toThrow(ValidationException::class)
        ->and(fn () => app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $ofArchivedClient)))->toThrow(ValidationException::class);
});

it('rejects private projects the user is not assigned to', function () {
    $private = Project::factory()->for($this->organization)->private()->create();

    expect(fn () => app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $private)))->toThrow(ValidationException::class);

    $private->members()->attach($this->member);

    expect(app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $private)))->toBeInstanceOf(TimeEntry::class);
});

it('rejects projects and users from another organization', function () {
    $foreignProject = Project::factory()->create();
    $outsider = User::factory()->create();

    expect(fn () => app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $foreignProject)))->toThrow(ValidationException::class)
        ->and(fn () => app(CreateTimeEntry::class)->handle($this->organization, entryData($outsider, $this->project)))->toThrow(ValidationException::class)
        ->and(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('keeps the rate snapshot when prices change and only re-resolves on project or user change', function () {
    $entry = app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project));
    $this->project->update(['hourly_rate' => 150000]);

    app(UpdateTimeEntry::class)->handle($entry, entryData($this->member, $this->project, overrides: ['description' => 'Edited']));
    expect($entry->fresh()->hourly_rate)->toBe(100000)
        ->and($entry->fresh()->description)->toBe('Edited');

    $other = Project::factory()->for($this->organization)->create(['hourly_rate' => 120000]);
    app(UpdateTimeEntry::class)->handle($entry, entryData($this->member, $other));
    expect($entry->fresh()->hourly_rate)->toBe(120000);
});

it('lets admins correct entries of deactivated members but gives them no new entries', function () {
    $entry = app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project));
    $this->organization->memberships()->where('user_id', $this->member->id)->update(['deactivated_at' => now()]);

    app(UpdateTimeEntry::class)->handle($entry, entryData($this->member, $this->project, overrides: ['description' => 'Fixed']));
    expect($entry->fresh()->description)->toBe('Fixed');

    app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project));
})->throws(ValidationException::class);

it('soft deletes and restores', function () {
    $entry = app(CreateTimeEntry::class)->handle($this->organization, entryData($this->member, $this->project));

    app(DeleteTimeEntry::class)->handle($entry);
    expect(TimeEntry::find($entry->id))->toBeNull();

    app(RestoreTimeEntry::class)->handle($entry);
    expect(TimeEntry::find($entry->id))->not->toBeNull();
});

it('creates several entries all or nothing', function () {
    $archived = Project::factory()->for($this->organization)->archived()->create();
    $entries = [
        entryData($this->member, $this->project),
        entryData($this->member, $archived),
    ];

    try {
        app(CreateTimeEntries::class)->handle($this->organization, $entries);
        $this->fail('Expected a validation exception.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('entries.1.project_id');
    }

    expect(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(0);

    $created = app(CreateTimeEntries::class)->handle($this->organization, [$entries[0], entryData($this->owner, $this->project)]);
    expect($created)->toHaveCount(2);
});

it('reprices an entry with the current rate order and billable setting', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)->create(['hourly_rate' => 50000, 'is_billable' => true]);
    $this->project->members()->attach($this->member, ['hourly_rate' => 120000]);

    expect(app(RepriceTimeEntry::class)->handle($entry, false))->toBeTrue()
        ->and($entry->fresh()->hourly_rate)->toBe(120000)
        ->and($entry->fresh()->is_billable)->toBeFalse()
        // Nothing left to change.
        ->and(app(RepriceTimeEntry::class)->handle($entry->fresh(), false))->toBeFalse();
});
