<?php

use App\Actions\Timers\DiscardTimer;
use App\Actions\Timers\StartTimer;
use App\Actions\Timers\StopTimer;
use App\Actions\Timers\UpdateTimer;
use App\Data\TimerData;
use App\Enums\OrganizationRole;
use App\Enums\TimeEntrySource;
use App\Models\Project;
use App\Models\RunningTimer;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-25 09:30:20', 'UTC'));
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->webbshop = Project::factory()->for($this->organization)->create(['name' => 'Webbshop', 'is_billable' => true]);
    $this->start = fn (User $user, array $data = []) => app(StartTimer::class)->handle($this->organization, $user, new TimerData(...[
        'projectId' => $this->webbshop->id,
        'startedAt' => CarbonImmutable::now(),
        ...$data,
    ]));
});

it('starts a timer and stops it as a time entry, kept to the minute', function () {
    $timer = ($this->start)($this->member, ['description' => ' Kodning ', 'tags' => ['Möte', 'möte', ' ']]);

    expect($timer->description)->toBe('Kodning')
        ->and($timer->tags)->toBe(['Möte']);

    $this->travelTo(CarbonImmutable::parse('2026-11-25 11:05:50', 'UTC'));
    $entry = app(StopTimer::class)->handle($timer->fresh());

    expect($entry->started_at->format('H:i:s'))->toBe('09:30:00')
        ->and($entry->ended_at->format('H:i:s'))->toBe('11:05:00')
        ->and($entry->duration_seconds)->toBe(95 * 60)
        ->and($entry->is_billable)->toBeTrue()
        ->and($entry->source)->toBe(TimeEntrySource::Web)
        ->and($entry->tagNames())->toBe(['Möte'])
        ->and(RunningTimer::query()->count())->toBe(0);
});

it('stops at a chosen end, and a timer of seconds becomes a minute', function () {
    $timer = ($this->start)($this->member);

    $this->travelTo(CarbonImmutable::parse('2026-11-25 09:30:50', 'UTC'));
    expect(app(StopTimer::class)->handle($timer->fresh())->duration_seconds)->toBe(60);

    $timer = ($this->start)($this->member);
    $entry = app(StopTimer::class)->handle($timer->fresh(), CarbonImmutable::parse('2026-11-25 10:00', 'UTC'), TimeEntrySource::Mcp);
    expect($entry->ended_at->format('H:i'))->toBe('10:00')
        ->and($entry->source)->toBe(TimeEntrySource::Mcp);
});

it('needs a project to stop, but not to start', function () {
    $timer = ($this->start)($this->member, ['projectId' => null]);

    expect(fn () => app(StopTimer::class)->handle($timer->fresh()))->toThrow(ValidationException::class);

    app(UpdateTimer::class)->handle($timer->fresh(), new TimerData($this->webbshop->id, $timer->started_at));
    $this->travel(5)->minutes();
    expect(app(StopTimer::class)->handle($timer->fresh())->project_id)->toBe($this->webbshop->id);
});

it('saves the running timer when another one starts, switching at the new start', function () {
    $intern = Project::factory()->for($this->organization)->create(['name' => 'Intern']);
    ($this->start)($this->member, ['startedAt' => CarbonImmutable::parse('2026-11-25 08:00', 'UTC')]);

    $timer = ($this->start)($this->member, ['projectId' => $intern->id, 'startedAt' => CarbonImmutable::parse('2026-11-25 09:00', 'UTC')]);

    $entry = TimeEntry::query()->sole();
    expect($entry->project_id)->toBe($this->webbshop->id)
        ->and($entry->ended_at->format('H:i'))->toBe('09:00')
        ->and(RunningTimer::query()->sole()->is($timer))->toBeTrue();

    // A running timer without a project can't be saved, so it must be stopped or discarded first.
    app(UpdateTimer::class)->handle($timer->fresh(), new TimerData(null, $timer->started_at));
    expect(fn () => ($this->start)($this->member))->toThrow(ValidationException::class);
});

it('rejects starts in the future, more than 24 hours ago, and projects the member may not use', function (array $data) {
    expect(fn () => ($this->start)($this->member, $data))->toThrow(ValidationException::class);
})->with([
    'future' => fn () => ['startedAt' => CarbonImmutable::now()->addHour()],
    'too old' => fn () => ['startedAt' => CarbonImmutable::now()->subHours(25)],
    'archived' => fn () => ['projectId' => Project::factory()->for(test()->organization)->archived()->create()->id],
    'private' => fn () => ['projectId' => Project::factory()->for(test()->organization)->private()->create()->id],
    'other organization' => fn () => ['projectId' => Project::factory()->create()->id],
]);

it('does not start when the organization turned the timer off, but a running one can still be stopped', function () {
    $timer = ($this->start)($this->member);
    $this->organization->update(['timer_enabled' => false]);

    expect(fn () => ($this->start)($this->member))->toThrow(ValidationException::class);

    $this->travel(10)->minutes();
    app(StopTimer::class)->handle($timer->fresh());
    expect(TimeEntry::query()->count())->toBe(1);
});

it('discards a timer without saving time', function () {
    app(DiscardTimer::class)->handle(($this->start)($this->member));

    expect(RunningTimer::query()->count())->toBe(0)
        ->and(TimeEntry::query()->count())->toBe(0);
});

it('finds the person\'s timer in any of their organizations, but only as an active member', function () {
    $timer = ($this->start)($this->member);
    $other = User::factory()->create()->currentOrganization;
    $other->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->member->update(['current_organization_id' => $other->id]);

    expect(RunningTimer::runningFor($this->member)?->is($timer))->toBeTrue()
        ->and(RunningTimer::runningFor($this->owner))->toBeNull();

    $this->organization->members()->updateExistingPivot($this->member->id, ['deactivated_at' => now()]);
    expect(RunningTimer::runningFor($this->member->fresh()))->toBeNull();
});

it('lets only the owner of a timer change it', function () {
    $timer = ($this->start)($this->member);

    expect($this->member->can('update', $timer))->toBeTrue()
        ->and($this->member->can('delete', $timer))->toBeTrue()
        ->and($this->owner->can('update', $timer))->toBeFalse()
        ->and($this->owner->can('delete', $timer))->toBeFalse();
});
