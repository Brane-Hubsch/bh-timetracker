<?php

use App\Models\Project;
use App\Support\EstimatePace;
use App\Support\WorkingDays;
use Carbon\CarbonImmutable;

function localDay(string $date): CarbonImmutable
{
    return CarbonImmutable::parse($date, 'Europe/Stockholm');
}

it('counts weekdays without Swedish holidays and the usual eves off', function () {
    // 23 Nov–31 Dec 2026: 29 weekdays, minus Christmas Eve, Christmas Day and New Year's Eve.
    expect(WorkingDays::between(localDay('2026-11-23'), localDay('2026-12-31')))->toBe(26)
        // Easter 2026: Good Friday 3 April to Easter Monday 6 April.
        ->and(WorkingDays::between(localDay('2026-04-03'), localDay('2026-04-06')))->toBe(0)
        // Ascension Day (14 May), National Day (Saturday 6 June) and midsummer eve (19 June).
        ->and(WorkingDays::between(localDay('2026-05-11'), localDay('2026-05-15')))->toBe(4)
        ->and(WorkingDays::between(localDay('2026-06-15'), localDay('2026-06-19')))->toBe(4)
        // Easter 2027 is 28 March: Good Friday 26 March, Easter Monday 29 March.
        ->and(WorkingDays::between(localDay('2027-03-26'), localDay('2027-03-29')))->toBe(0)
        ->and(WorkingDays::between(localDay('2026-12-31'), localDay('2026-12-01')))->toBe(0);
});

it('gives the hours left to the estimate and the pace per working day in the period', function () {
    $project = new Project(['estimate_seconds' => 944 * 3600, 'starts_on' => '2026-07-01', 'ends_on' => '2026-12-31']);

    expect(EstimatePace::for($project, (int) (638.5 * 3600), localDay('2026-11-23 15:00')))->toBe([
        'remainingSeconds' => (int) (305.5 * 3600),
        'workdaysLeft' => 26,
        'secondsPerWorkday' => (int) ceil(305.5 * 3600 / 26),
        'from' => '2026-11-23',
        'to' => '2026-12-31',
    ]);
});

it('counts from the start of a project that has not started yet', function () {
    $project = new Project(['estimate_seconds' => 40 * 3600, 'starts_on' => '2026-12-07', 'ends_on' => '2026-12-11']);

    expect(EstimatePace::for($project, 0, localDay('2026-11-23')))->toMatchArray([
        'workdaysLeft' => 5,
        'secondsPerWorkday' => 8 * 3600,
        'from' => '2026-12-07',
    ]);
});

it('has no pace without an end date, after the period or once the estimate is reached', function () {
    expect(EstimatePace::for(new Project(['estimate_seconds' => null]), 0, localDay('2026-11-23')))->toBeNull()
        ->and(EstimatePace::for(new Project(['estimate_seconds' => 3600]), 0, localDay('2026-11-23')))
        ->toMatchArray(['remainingSeconds' => 3600, 'workdaysLeft' => null, 'secondsPerWorkday' => null])
        ->and(EstimatePace::for(new Project(['estimate_seconds' => 3600, 'ends_on' => '2026-11-20']), 0, localDay('2026-11-23')))
        ->toMatchArray(['workdaysLeft' => 0, 'secondsPerWorkday' => null])
        ->and(EstimatePace::for(new Project(['estimate_seconds' => 3600, 'ends_on' => '2026-12-31']), 7200, localDay('2026-11-23')))
        ->toMatchArray(['remainingSeconds' => -3600, 'secondsPerWorkday' => null]);
});
