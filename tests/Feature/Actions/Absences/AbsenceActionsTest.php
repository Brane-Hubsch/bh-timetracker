<?php

use App\Actions\Absences\CreateAbsence;
use App\Actions\Absences\DeleteAbsence;
use App\Actions\Absences\UpdateAbsence;
use App\Actions\Holidays\AddSwedishHolidays;
use App\Data\AbsenceData;
use App\Enums\AbsenceType;
use App\Enums\OrganizationRole;
use App\Models\Absence;
use App\Models\User;
use App\Support\AbsenceTime;
use App\Support\HolidayDates;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    app(AddSwedishHolidays::class)->handle($this->organization, 2026);
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Anna']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->absence = fn (string $from, string $to, ?int $secondsPerDay = null, AbsenceType $type = AbsenceType::Vacation, ?User $user = null) => new AbsenceData(
        userId: ($user ?? $this->member)->id,
        type: $type,
        startsOn: CarbonImmutable::parse($from),
        endsOn: CarbonImmutable::parse($to),
        secondsPerDay: $secondsPerDay,
        note: '  ',
    );
});

it('registers absence over a period, counting working days only', function () {
    // 21–31 Dec 2026: 9 weekdays, minus Christmas Eve, Christmas Day and New Year's Eve.
    $absence = app(CreateAbsence::class)->handle($this->organization, ($this->absence)('2026-12-21', '2026-12-31'));
    $time = AbsenceTime::for(CarbonImmutable::parse('2026-12-21'), CarbonImmutable::parse('2026-12-31'), null, $this->organization->workday_seconds, HolidayDates::between($this->organization->id, CarbonImmutable::parse('2026-12-21'), CarbonImmutable::parse('2026-12-31')));

    expect($absence->type)->toBe(AbsenceType::Vacation)
        ->and($absence->note)->toBeNull()
        ->and($absence->seconds_per_day)->toBeNull()
        ->and($time)->toBe(['days' => 6, 'seconds' => 6 * 8 * 3600]);
});

it('registers part of a day, e.g. care of a sick child in the morning', function () {
    $absence = app(CreateAbsence::class)->handle($this->organization, ($this->absence)('2026-11-23', '2026-11-23', 4 * 3600, AbsenceType::ChildCare));

    expect($absence->seconds_per_day)->toBe(4 * 3600)
        ->and(AbsenceTime::for(CarbonImmutable::parse('2026-11-23'), CarbonImmutable::parse('2026-11-23'), 4 * 3600, 28800, []))->toBe(['days' => 1, 'seconds' => 4 * 3600]);
});

it('rejects periods without working days, backwards periods, overlaps, too many hours and outsiders', function (Closure $data, string $field) {
    app(CreateAbsence::class)->handle($this->organization, ($this->absence)('2026-11-23', '2026-11-25'));

    try {
        app(CreateAbsence::class)->handle($this->organization, $data->call($this));
        $this->fail('Expected a validation error.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey($field);
    }
})->with([
    'a weekend' => [fn () => ($this->absence)('2026-11-28', '2026-11-29'), 'starts_on'],
    'a holiday' => [fn () => ($this->absence)('2026-12-24', '2026-12-25'), 'starts_on'],
    'ends before it starts' => [fn () => ($this->absence)('2026-11-30', '2026-11-27'), 'ends_on'],
    'overlaps another absence' => [fn () => ($this->absence)('2026-11-25', '2026-11-26'), 'starts_on'],
    'more than 24 hours a day' => [fn () => ($this->absence)('2026-11-30', '2026-11-30', 25 * 3600), 'hours_per_day'],
    'longer than a year' => [fn () => ($this->absence)('2026-01-01', '2027-01-05'), 'ends_on'],
    'someone outside the organization' => [fn () => ($this->absence)('2026-11-30', '2026-11-30', null, AbsenceType::Sick, User::factory()->create()), 'user_id'],
]);

it('updates and deletes an absence, and lets it move over its own old days', function () {
    $absence = app(CreateAbsence::class)->handle($this->organization, ($this->absence)('2026-11-23', '2026-11-25'));

    app(UpdateAbsence::class)->handle($absence, ($this->absence)('2026-11-24', '2026-11-27', null, AbsenceType::Sick));
    expect($absence->fresh()->type)->toBe(AbsenceType::Sick)
        ->and($absence->fresh()->ends_on->toDateString())->toBe('2026-11-27');

    app(DeleteAbsence::class)->handle($absence);
    expect(Absence::query()->forOrganization($this->organization)->exists())->toBeFalse();
});

it('lets members manage their own absence and owners and admins everyone\'s, within the organization', function () {
    $own = Absence::factory()->by($this->member, $this->organization)->create();
    $owners = Absence::factory()->by($this->owner, $this->organization)->create();
    $outsider = User::factory()->create();

    expect($this->member->can('update', $own))->toBeTrue()
        ->and($this->member->can('delete', $owners))->toBeFalse()
        ->and($this->owner->can('update', $own))->toBeTrue()
        ->and($this->member->can('manageFor', [Absence::class, $this->organization, $this->owner]))->toBeFalse()
        ->and($this->owner->can('manageFor', [Absence::class, $this->organization, $this->member]))->toBeTrue()
        ->and($outsider->can('view', $own))->toBeFalse()
        ->and($outsider->can('manageFor', [Absence::class, $this->organization, $outsider]))->toBeFalse();
});
