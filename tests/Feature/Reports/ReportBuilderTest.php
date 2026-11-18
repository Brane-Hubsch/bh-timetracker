<?php

use App\Enums\OrganizationRole;
use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportFilters;
use Carbon\CarbonImmutable;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    $this->web = Project::factory()->for($this->organization)->create(['name' => 'Webb', 'client_id' => $this->client->id]);
    $this->internal = Project::factory()->for($this->organization)->create(['name' => 'Intern', 'is_billable' => false]);
    $this->builder = app(ReportBuilder::class);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function reportEntry(User $user, Project $project, string $startUtc, int $minutes, ?int $rate = 100000, ?bool $billable = null): TimeEntry
{
    $start = CarbonImmutable::parse($startUtc, 'UTC');

    return TimeEntry::factory()->by($user, $project)->between($start, $start->addMinutes($minutes))->create([
        'hourly_rate' => $rate,
        'is_billable' => $billable ?? $project->is_billable,
    ]);
}

function reportFilters(User $viewer, ?string $from = '2026-11-01', ?string $to = '2026-11-30', array $overrides = []): ReportFilters
{
    return new ReportFilters(...[
        'organization' => test()->organization,
        'viewer' => $viewer,
        'from' => $from ? CarbonImmutable::parse($from) : null,
        'to' => $to ? CarbonImmutable::parse($to) : null,
        ...$overrides,
    ]);
}

it('sums hours, billable hours and amounts', function () {
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 90);
    reportEntry($this->member, $this->internal, '2026-11-16 10:00', 60);
    reportEntry($this->owner, $this->web, '2026-11-17 08:00', 30, rate: 120000);

    $summary = $this->builder->summary(reportFilters($this->owner), ReportGrouping::Project);

    expect($summary['totals'])->toBe(['seconds' => 3 * 3600, 'billableSeconds' => 2 * 3600, 'amount' => 150000 + 60000])
        ->and($summary['groups'][0])->toMatchArray(['label' => 'Webb', 'seconds' => 7200, 'amount' => 210000])
        ->and($summary['groups'][1])->toMatchArray(['label' => 'Intern', 'seconds' => 3600, 'billableSeconds' => 0, 'amount' => 0]);
});

it('limits members to their own time and hides amounts', function () {
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 60);
    reportEntry($this->owner, $this->web, '2026-11-16 08:00', 120);

    $summary = $this->builder->summary(
        reportFilters($this->member, overrides: ['userIds' => [$this->owner->id]]),
        ReportGrouping::Member,
    );

    expect($summary['totals'])->toBe(['seconds' => 3600, 'billableSeconds' => 3600, 'amount' => null])
        ->and($summary['groups'])->toHaveCount(1)
        ->and($summary['groups'][0]['label'])->toBe('Mia Member')
        ->and($summary['groups'][0]['amount'])->toBeNull();
});

it('filters by member, client, project and billable', function (array $overrides, int $hours) {
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 60);
    reportEntry($this->member, $this->internal, '2026-11-16 09:00', 120);
    reportEntry($this->owner, $this->web, '2026-11-16 08:00', 240);

    $overrides = array_map(fn ($value) => $value instanceof Closure ? $value() : $value, $overrides);

    expect($this->builder->totalsFor(reportFilters($this->owner, overrides: $overrides))['seconds'])->toBe($hours * 3600);
})->with([
    'nothing' => [[], 7],
    'member' => [['userIds' => fn () => [test()->member->id]], 3],
    'client' => [['clientIds' => fn () => [test()->client->id]], 5],
    'project' => [['projectIds' => fn () => [test()->internal->id]], 2],
    'billable' => [['billable' => true], 5],
    'not billable' => [['billable' => false], 2],
]);

it('never includes another organization', function () {
    $other = Organization::factory()->create();
    $otherUser = User::factory()->withoutOrganization()->create();
    $other->members()->attach($otherUser, ['role' => OrganizationRole::Owner->value]);
    $foreignProject = Project::factory()->for($other)->create();
    TimeEntry::factory()->by($otherUser, $foreignProject)->between(CarbonImmutable::parse('2026-11-16 08:00'), CarbonImmutable::parse('2026-11-16 10:00'))->create();
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 60);

    $filters = reportFilters($this->owner, overrides: ['userIds' => [$otherUser->id, $this->member->id], 'projectIds' => [$foreignProject->id, $this->web->id]]);

    expect($this->builder->totalsFor($filters)['seconds'])->toBe(3600)
        ->and($this->builder->summary(reportFilters($this->owner, from: null, to: null), ReportGrouping::Project)['groups'])->toHaveCount(1);
});

it('counts entries to the local day they start on', function () {
    // 23:30 UTC on Nov 15 is 00:30 on Nov 16 in Stockholm; the entry runs past midnight UTC.
    reportEntry($this->member, $this->web, '2026-11-15 23:30', 120);
    // 22:30 UTC on Nov 30 is still Nov 30 in Stockholm (23:30) – inside the period.
    reportEntry($this->member, $this->web, '2026-11-30 22:30', 60);
    // 23:30 UTC on Nov 30 is Dec 1 in Stockholm – outside the period.
    reportEntry($this->member, $this->web, '2026-11-30 23:30', 60);

    $summary = $this->builder->summary(reportFilters($this->member), ReportGrouping::Day);

    expect(array_column($summary['groups'], 'key'))->toBe(['2026-11-16', '2026-11-30'])
        ->and($summary['totals']['seconds'])->toBe(3 * 3600);
});

it('groups in two levels and by week and month', function () {
    reportEntry($this->member, $this->web, '2026-11-09 08:00', 60);
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 60);
    reportEntry($this->owner, $this->internal, '2026-11-17 08:00', 180);

    $byClient = $this->builder->summary(reportFilters($this->owner), ReportGrouping::Client, ReportGrouping::Member);

    expect($byClient['groups'][0])->toMatchArray(['label' => __('No client'), 'seconds' => 10800])
        ->and($byClient['groups'][1]['label'])->toBe('Acme')
        ->and($byClient['groups'][1]['children'][0])->toMatchArray(['label' => 'Mia Member', 'seconds' => 7200]);

    $byWeek = $this->builder->summary(reportFilters($this->owner), ReportGrouping::Week);
    expect(array_column($byWeek['groups'], 'key'))->toBe(['2026-11-09', '2026-11-16']);

    $byMonth = $this->builder->summary(reportFilters($this->owner), ReportGrouping::Month);
    expect(array_column($byMonth['groups'], 'key'))->toBe(['2026-11-01']);
});

it('builds a daily timeline for short periods and a weekly one for long periods', function () {
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 60);

    $month = $this->builder->summary(reportFilters($this->member), ReportGrouping::Project)['timeline'];
    expect($month['unit'])->toBe('day')
        ->and($month['buckets'])->toHaveCount(30)
        ->and($month['buckets'][15])->toBe(['key' => '2026-11-16', 'seconds' => 3600, 'billableSeconds' => 3600]);

    $year = $this->builder->summary(reportFilters($this->member, '2026-01-01', '2026-12-31'), ReportGrouping::Project)['timeline'];
    expect($year['unit'])->toBe('week')
        ->and($year['buckets'][0]['key'])->toBe('2025-12-29')
        ->and(collect($year['buckets'])->firstWhere('key', '2026-11-16')['seconds'])->toBe(3600);
});

it('resolves period presets in the organization week', function () {
    $today = CarbonImmutable::parse('2026-11-18');

    expect(array_map(fn ($date) => $date->toDateString(), ReportPeriod::ThisWeek->range($today, 1)))->toBe(['2026-11-16', '2026-11-22'])
        ->and(array_map(fn ($date) => $date->toDateString(), ReportPeriod::ThisWeek->range($today, 7)))->toBe(['2026-11-15', '2026-11-21'])
        ->and(array_map(fn ($date) => $date->toDateString(), ReportPeriod::LastWeek->range($today, 1)))->toBe(['2026-11-09', '2026-11-15'])
        ->and(array_map(fn ($date) => $date->toDateString(), ReportPeriod::LastMonth->range(CarbonImmutable::parse('2026-03-31'), 1)))->toBe(['2026-02-01', '2026-02-28'])
        ->and(array_map(fn ($date) => $date->toDateString(), ReportPeriod::ThisYear->range($today, 1)))->toBe(['2026-01-01', '2026-12-31']);
});

it('shows project follow-up for accessible active projects', function () {
    $this->web->update(['estimate_seconds' => 10 * 3600]);
    $private = Project::factory()->for($this->organization)->private()->create(['name' => 'Hemligt']);
    Project::factory()->for($this->organization)->archived()->create(['name' => 'Gammalt']);
    reportEntry($this->member, $this->web, '2026-11-16 08:00', 4 * 60);
    reportEntry($this->owner, $this->web, '2026-11-16 08:00', 4 * 60);

    $forOwner = collect($this->builder->projectFollowUp($this->organization, $this->owner));
    $forMember = collect($this->builder->projectFollowUp($this->organization, $this->member));

    expect($forOwner->pluck('name')->all())->toBe(['Hemligt', 'Intern', 'Webb'])
        ->and($forMember->pluck('name')->all())->toBe(['Intern', 'Webb'])
        ->and($forOwner->firstWhere('name', 'Webb'))->toMatchArray([
            'estimateSeconds' => 36000, 'consumedSeconds' => 28800, 'remainingSeconds' => 7200, 'percent' => 80,
        ])
        ->and($forOwner->firstWhere('name', 'Intern'))->toMatchArray(['estimateSeconds' => null, 'percent' => null]);
});
