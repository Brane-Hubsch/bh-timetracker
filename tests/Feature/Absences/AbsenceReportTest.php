<?php

use App\Enums\AbsenceType;
use App\Enums\OrganizationRole;
use App\Models\Absence;
use App\Models\Holiday;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo('2026-12-15 10:00');
    $this->owner = User::factory()->create(['name' => 'Olivia']);
    $this->organization = $this->owner->currentOrganization;
    $this->organization->update(['workday_seconds' => 8 * 3600]);
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Anna', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    Holiday::factory()->for($this->organization)->create(['date' => '2026-12-25 00:00:00']);

    // Anna: vacation Mon 21 Dec – Fri 8 Jan (only December is in the report) and half a day of VAB.
    Absence::factory()->by($this->member, $this->organization)->create(['starts_on' => '2026-12-21', 'ends_on' => '2027-01-08']);
    Absence::factory()->by($this->member, $this->organization)->create(['type' => AbsenceType::ChildCare, 'starts_on' => '2026-12-02', 'ends_on' => '2026-12-02', 'seconds_per_day' => 4 * 3600]);
    // Olivia: sick a day in December, and vacation in November that falls outside the period.
    Absence::factory()->by($this->owner, $this->organization)->create(['type' => AbsenceType::Sick, 'starts_on' => '2026-12-07', 'ends_on' => '2026-12-07']);
    Absence::factory()->by($this->owner, $this->organization)->create(['starts_on' => '2026-11-02', 'ends_on' => '2026-11-06']);

    $this->report = fn (array $query = []) => route('reports.summary', [
        $this->organization->slug,
        'period' => 'custom',
        'from' => '2026-12-01',
        'to' => '2026-12-31',
        ...$query,
    ]);
});

it('sums absence per member and type within the period, skipping weekends and holidays', function () {
    $this->actingAs($this->owner)->get(($this->report)())
        ->assertInertia(fn (Assert $page) => $page
            ->where('absence.workdaySeconds', 8 * 3600)
            ->has('absence.types', 6)
            ->where('absence.members', [
                // 21–31 Dec: 9 weekdays minus Christmas Day = 8 days, plus 4 h of VAB.
                ['id' => $this->member->id, 'name' => 'Anna', 'seconds' => 8 * 8 * 3600 + 4 * 3600, 'types' => ['vacation' => 8 * 8 * 3600, 'child_care' => 4 * 3600]],
                ['id' => $this->owner->id, 'name' => 'Olivia', 'seconds' => 8 * 3600, 'types' => ['sick' => 8 * 3600]],
            ]));

    $this->get(($this->report)(['members' => [$this->owner->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('absence.members', 1)
            ->where('absence.members.0.name', 'Olivia'));
});

it('shows members only their own absence', function () {
    $this->actingAs($this->member)->get(($this->report)(['members' => [$this->owner->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('absence.members', 1)
            ->where('absence.members.0.name', 'Anna'));
});

it('leaves out other organizations\' absence', function () {
    $outsider = User::factory()->create();
    Absence::factory()->by($outsider, $outsider->currentOrganization)->create(['starts_on' => '2026-12-14', 'ends_on' => '2026-12-18']);

    $this->actingAs($this->owner)->get(($this->report)())
        ->assertInertia(fn (Assert $page) => $page
            ->where('absence.members', fn ($members) => collect($members)->pluck('name')->all() === ['Anna', 'Olivia']));
});
