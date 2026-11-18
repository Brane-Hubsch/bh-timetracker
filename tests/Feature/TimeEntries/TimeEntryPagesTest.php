<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
    $this->admin = User::factory()->withoutOrganization()->create(['name' => 'Adam Admin']);
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->colleague = User::factory()->withoutOrganization()->create(['name' => 'Cole Colleague']);
    $this->organization->members()->attach($this->admin, ['role' => OrganizationRole::Admin->value]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->organization->members()->attach($this->colleague, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create(['hourly_rate' => 100000]);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function timeRoute(string $name, array $parameters = []): string
{
    return route($name, ['current_organization' => test()->slug, ...$parameters]);
}

function timePayload(array $overrides = []): array
{
    return [
        'project_id' => test()->project->id,
        'description' => 'Möte',
        'date' => '2026-11-18',
        'start' => '09:00',
        'end' => '10:30',
        ...$overrides,
    ];
}

function entryFor(User $user, string $start = '2026-11-16 08:00', string $end = '2026-11-16 10:00'): TimeEntry
{
    return TimeEntry::factory()->by($user, test()->project)->between(
        CarbonImmutable::parse($start, 'UTC'),
        CarbonImmutable::parse($end, 'UTC'),
    )->create();
}

it('shows the week of the signed-in user in their time zone', function () {
    $mine = entryFor($this->member, '2026-11-16 07:00', '2026-11-16 08:30');
    entryFor($this->colleague);
    entryFor($this->member, '2026-11-09 07:00', '2026-11-09 08:00');

    $this->actingAs($this->member)
        ->get(timeRoute('time.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('time/index')
            ->where('weekStart', '2026-11-16')
            ->where('today', '2026-11-18')
            ->has('entries', 1)
            ->where('entries.0.id', $mine->id)
            ->where('entries.0.start', '2026-11-16T08:00')
            ->where('entries.0.end', '2026-11-16T09:30')
            ->where('entries.0.durationSeconds', 5400)
            ->where('member.id', $this->member->id)
            ->where('members', [])
            ->missing('previousWeek'));
});

it('loads the previous week on demand', function () {
    $previous = entryFor($this->member, '2026-11-09 07:00', '2026-11-09 08:00');

    $this->actingAs($this->member)
        ->get(timeRoute('time.index', ['date' => '2026-11-17']))
        ->assertInertia(fn (Assert $page) => $page
            ->reloadOnly('previousWeek', fn (Assert $reload) => $reload
                ->has('previousWeek', 1)
                ->where('previousWeek.0.id', $previous->id)));
});

it('lets admins view another member but not members', function () {
    entryFor($this->colleague);

    $this->actingAs($this->admin)
        ->get(timeRoute('time.index', ['date' => '2026-11-16', 'user' => $this->colleague->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('member.id', $this->colleague->id)
            ->has('entries', 1)
            ->has('members', 4));

    $this->actingAs($this->member)
        ->get(timeRoute('time.index', ['user' => $this->colleague->id]))
        ->assertForbidden();
});

it('does not show members of another organization', function () {
    $outsider = User::factory()->create();

    $this->actingAs($this->admin)
        ->get(timeRoute('time.index', ['user' => $outsider->id]))
        ->assertForbidden();
});

it('stores an entry entered in the user time zone as UTC', function () {
    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload())
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $entry = TimeEntry::sole();

    expect($entry->user_id)->toBe($this->member->id)
        ->and($entry->started_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-18 08:00')
        ->and($entry->ended_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-18 09:30')
        ->and($entry->duration_seconds)->toBe(5400)
        ->and($entry->hourly_rate)->toBe(100000)
        ->and($entry->source->value)->toBe('web');
});

it('accepts a duration instead of an end time', function (string $duration, int $seconds) {
    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload(['end' => null, 'duration' => $duration]))
        ->assertSessionHasNoErrors();

    expect(TimeEntry::sole()->duration_seconds)->toBe($seconds);
})->with([
    ['1,5', 5400],
    ['1:30', 5400],
    ['90m', 5400],
]);

it('treats an end before the start as the next day', function () {
    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload(['start' => '22:00', 'end' => '01:00']))
        ->assertSessionHasNoErrors();

    expect(TimeEntry::sole()->duration_seconds)->toBe(3 * 3600);
});

it('validates the input', function (array $overrides, string $field) {
    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload($overrides))
        ->assertSessionHasErrors($field);

    expect(TimeEntry::count())->toBe(0);
})->with([
    'no project' => [['project_id' => null], 'project_id'],
    'bad date' => [['date' => '18/11/2026'], 'date'],
    'bad start' => [['start' => '9'], 'start'],
    'no end or duration' => [['end' => null], 'end'],
    'unparsable duration' => [['end' => null, 'duration' => 'lång'], 'duration'],
]);

it('rejects a project from another organization', function () {
    $foreign = Project::factory()->create();

    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload(['project_id' => $foreign->id]))
        ->assertSessionHasErrors('project_id');

    expect(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('lets admins report time for a member but not members for each other', function () {
    $this->actingAs($this->admin)
        ->post(timeRoute('time.store'), timePayload(['user_id' => $this->colleague->id]))
        ->assertSessionHasNoErrors();

    expect(TimeEntry::sole()->user_id)->toBe($this->colleague->id);

    $this->actingAs($this->member)
        ->post(timeRoute('time.store'), timePayload(['user_id' => $this->colleague->id]))
        ->assertForbidden();

    expect(TimeEntry::count())->toBe(1);
});

it('lets the owner of an entry and admins update it', function () {
    $entry = entryFor($this->member);

    $this->actingAs($this->member)
        ->patch(timeRoute('time.update', ['timeEntry' => $entry->id]), timePayload(['description' => 'Ändrad']))
        ->assertSessionHasNoErrors();

    expect($entry->fresh()->description)->toBe('Ändrad')
        ->and($entry->fresh()->user_id)->toBe($this->member->id);

    $this->actingAs($this->admin)
        ->patch(timeRoute('time.update', ['timeEntry' => $entry->id]), timePayload(['description' => 'Rättad']))
        ->assertSessionHasNoErrors();

    expect($entry->fresh()->description)->toBe('Rättad')
        ->and($entry->fresh()->user_id)->toBe($this->member->id);
});

it('forbids members to change or delete entries of others', function () {
    $entry = entryFor($this->colleague);

    $this->actingAs($this->member)
        ->patch(timeRoute('time.update', ['timeEntry' => $entry->id]), timePayload())
        ->assertForbidden();

    $this->actingAs($this->member)
        ->delete(timeRoute('time.destroy', ['timeEntry' => $entry->id]))
        ->assertForbidden();

    expect($entry->fresh()->trashed())->toBeFalse();
});

it('forbids members to move their own entry to someone else', function () {
    $entry = entryFor($this->member);

    $this->actingAs($this->member)
        ->patch(timeRoute('time.update', ['timeEntry' => $entry->id]), timePayload(['user_id' => $this->colleague->id]))
        ->assertForbidden();

    expect($entry->fresh()->user_id)->toBe($this->member->id);
});

it('deletes with an undo link and restores', function () {
    $entry = entryFor($this->member);

    $this->actingAs($this->member)
        ->delete(timeRoute('time.destroy', ['timeEntry' => $entry->id]))
        ->assertRedirect()
        ->assertInertiaFlash('toast.undo', timeRoute('time.restore', ['timeEntry' => $entry->id]));

    expect($entry->fresh()->trashed())->toBeTrue();

    $this->actingAs($this->member)
        ->post(timeRoute('time.restore', ['timeEntry' => $entry->id]))
        ->assertRedirect();

    expect($entry->fresh()->trashed())->toBeFalse();
});

it('forbids restoring entries of others', function () {
    $entry = entryFor($this->colleague);
    $entry->delete();

    $this->actingAs($this->member)
        ->post(timeRoute('time.restore', ['timeEntry' => $entry->id]))
        ->assertForbidden();

    expect($entry->fresh()->trashed())->toBeTrue();
});

it('returns 404 for entries of another organization', function () {
    $other = Organization::factory()->create();
    $otherUser = User::factory()->withoutOrganization()->create();
    $other->members()->attach($otherUser, ['role' => OrganizationRole::Owner->value]);
    $foreign = TimeEntry::factory()->by($otherUser, Project::factory()->for($other)->create())->create();

    $this->actingAs($this->owner)
        ->patch(timeRoute('time.update', ['timeEntry' => $foreign->id]), timePayload())
        ->assertNotFound();

    $this->actingAs($this->owner)
        ->delete(timeRoute('time.destroy', ['timeEntry' => $foreign->id]))
        ->assertNotFound();

    $this->actingAs($this->owner)
        ->post(timeRoute('time.copy'), ['entry_ids' => [$foreign->id]])
        ->assertNotFound();

    expect(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('copies selected entries to the following week', function () {
    $first = entryFor($this->member, '2026-11-09 07:00', '2026-11-09 09:00');
    $second = entryFor($this->member, '2026-11-10 07:00', '2026-11-10 08:00');
    entryFor($this->member, '2026-11-11 07:00', '2026-11-11 08:00');

    $this->actingAs($this->member)
        ->post(timeRoute('time.copy'), ['entry_ids' => [$first->id, $second->id]])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $copies = TimeEntry::query()->where('started_at', '>=', '2026-11-16')->orderBy('started_at')->get();

    expect($copies)->toHaveCount(2)
        ->and($copies[0]->started_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-16 07:00')
        ->and($copies[0]->duration_seconds)->toBe(7200)
        ->and($copies[1]->started_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-17 07:00');
});

it('forbids members to copy entries of others', function () {
    $entry = entryFor($this->colleague, '2026-11-09 07:00', '2026-11-09 09:00');

    $this->actingAs($this->member)
        ->post(timeRoute('time.copy'), ['entry_ids' => [$entry->id]])
        ->assertForbidden();

    expect(TimeEntry::count())->toBe(1);
});
