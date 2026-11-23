<?php

use App\Actions\Holidays\AddSwedishHolidays;
use App\Models\Holiday;
use App\Models\Organization;
use App\Models\Project;
use App\Support\EstimatePace;
use App\Support\SwedishHolidays;
use App\Support\WorkingDays;
use Carbon\CarbonImmutable;

function localDay(string $date): CarbonImmutable
{
    return CarbonImmutable::parse($date, 'Europe/Stockholm');
}

beforeEach(function () {
    $this->organization = Organization::factory()->create();
    // Holidays come from the organization; start from a clean slate.
    Holiday::query()->forOrganization($this->organization)->delete();
    app(AddSwedishHolidays::class)->handle($this->organization, 2026);
});

it('knows the Swedish holidays, including Easter and midsummer eve', function () {
    expect(array_keys(SwedishHolidays::for(2026)))->toBe([
        '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14',
        '2026-06-06', '2026-06-19', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-31',
    ])
        // Easter 2027 is 28 March.
        ->and(array_keys(SwedishHolidays::for(2027)))->toContain('2027-03-26', '2027-03-29', '2027-05-06', '2027-06-25');
});

it('counts weekdays without the given holidays', function () {
    // 23 Nov–31 Dec 2026: 29 weekdays.
    expect(WorkingDays::between(localDay('2026-11-23'), localDay('2026-12-31')))->toBe(29)
        ->and(WorkingDays::between(localDay('2026-11-23'), localDay('2026-12-31'), ['2026-12-24', '2026-12-25', '2026-12-31']))->toBe(26)
        ->and(WorkingDays::between(localDay('2026-12-31'), localDay('2026-12-01')))->toBe(0);
});

it('gives the hours left to the estimate and the pace per working day without the organization\'s holidays', function () {
    $project = Project::factory()->for($this->organization)->create(['estimate_seconds' => 944 * 3600, 'starts_on' => '2026-07-01', 'ends_on' => '2026-12-31']);

    expect(EstimatePace::for($project, (int) (638.5 * 3600), localDay('2026-11-23 15:00')))->toBe([
        'remainingSeconds' => (int) (305.5 * 3600),
        'workdaysLeft' => 26,
        'secondsPerWorkday' => (int) ceil(305.5 * 3600 / 26),
        'from' => '2026-11-23',
        'to' => '2026-12-31',
    ]);

    // An organization's own day off counts too; another organization's doesn't.
    Holiday::factory()->for($this->organization)->create(['date' => '2026-12-28', 'name' => 'Kick-off']);
    Holiday::factory()->create(['date' => '2026-12-29']);

    expect(EstimatePace::for($project->fresh(), 0, localDay('2026-11-23'))['workdaysLeft'])->toBe(25);
});

it('counts from the start of a project that has not started yet', function () {
    $project = Project::factory()->for($this->organization)->create(['estimate_seconds' => 40 * 3600, 'starts_on' => '2026-12-07', 'ends_on' => '2026-12-11']);

    expect(EstimatePace::for($project, 0, localDay('2026-11-23')))->toMatchArray([
        'workdaysLeft' => 5,
        'secondsPerWorkday' => 8 * 3600,
        'from' => '2026-12-07',
    ]);
});

it('has no pace without an end date, after the period or once the estimate is reached', function () {
    $project = fn (array $attributes) => Project::factory()->for($this->organization)->create($attributes);

    expect(EstimatePace::for($project(['estimate_seconds' => null]), 0, localDay('2026-11-23')))->toBeNull()
        ->and(EstimatePace::for($project(['estimate_seconds' => 3600, 'ends_on' => null]), 0, localDay('2026-11-23')))
        ->toMatchArray(['remainingSeconds' => 3600, 'workdaysLeft' => null, 'secondsPerWorkday' => null])
        ->and(EstimatePace::for($project(['estimate_seconds' => 3600, 'ends_on' => '2026-11-20']), 0, localDay('2026-11-23')))
        ->toMatchArray(['workdaysLeft' => 0, 'secondsPerWorkday' => null])
        ->and(EstimatePace::for($project(['estimate_seconds' => 3600, 'ends_on' => '2026-12-31']), 7200, localDay('2026-11-23')))
        ->toMatchArray(['remainingSeconds' => -3600, 'secondsPerWorkday' => null]);
});
