<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use OpenSpout\Reader\XLSX\Reader;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    $this->project = Project::factory()->for($this->organization)->create(['name' => 'Webb', 'client_id' => $this->client->id, 'estimate_seconds' => 10 * 3600]);

    $add = fn (User $user, string $start, int $minutes) => TimeEntry::factory()->by($user, $this->project)
        ->between(CarbonImmutable::parse($start, 'UTC'), CarbonImmutable::parse($start, 'UTC')->addMinutes($minutes))
        ->create(['hourly_rate' => 100000, 'is_billable' => true, 'description' => 'Kodning']);

    $add($this->member, '2026-11-16 08:00', 90);
    $add($this->owner, '2026-11-17 08:00', 60);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function reportRoute(string $name, array $query = []): string
{
    return route($name, ['current_organization' => test()->slug, ...$query]);
}

it('shows owners the whole team with amounts', function () {
    $this->actingAs($this->owner)
        ->get(reportRoute('reports.summary', ['group' => 'member', 'subgroup' => 'none']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('reports/summary')
            ->where('filters.period', 'this_month')
            ->where('filters.from', '2026-11-01')
            ->where('filters.to', '2026-11-30')
            ->where('summary.totals', ['seconds' => 9000, 'billableSeconds' => 9000, 'amount' => 250000])
            ->has('summary.groups', 2)
            ->has('options.members', 2)
            ->where('abilities', ['canViewTeam' => true, 'canViewAmounts' => true]));
});

it('shows members only their own time and no amounts', function () {
    $this->actingAs($this->member)
        ->get(reportRoute('reports.summary', ['members' => [$this->owner->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals', ['seconds' => 5400, 'billableSeconds' => 5400, 'amount' => null])
            ->where('summary.groups.0.amount', null)
            ->where('options.members', [])
            ->where('abilities', ['canViewTeam' => false, 'canViewAmounts' => false]));

    $this->actingAs($this->member)
        ->get(reportRoute('reports.detailed'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('reports/detailed')
            ->has('entries.data', 1)
            ->where('entries.data.0.memberName', 'Mia Member')
            ->where('entries.data.0.hourlyRate', null)
            ->where('entries.data.0.amount', null)
            ->where('totals.amount', null));
});

it('sorts and filters the detailed report from the URL', function () {
    $this->actingAs($this->owner)
        ->get(reportRoute('reports.detailed', ['sort' => 'duration', 'direction' => 'asc', 'period' => 'custom', 'from' => '2026-11-16', 'to' => '2026-11-17']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'duration')
            ->where('filters.period', 'custom')
            ->where('entries.data.0.durationSeconds', 3600)
            ->where('entries.data.1.durationSeconds', 5400)
            ->where('entries.data.1.amount', 150000));
});

it('validates report filters', function (array $query, string $field) {
    $this->actingAs($this->owner)
        ->get(reportRoute('reports.summary', $query))
        ->assertSessionHasErrors($field);
})->with([
    'unknown period' => [['period' => 'forever'], 'period'],
    'custom without dates' => [['period' => 'custom'], 'from'],
    'end before start' => [['period' => 'custom', 'from' => '2026-11-10', 'to' => '2026-11-01'], 'to'],
    'unknown grouping' => [['group' => 'colour'], 'group'],
]);

it('shows project follow-up', function () {
    $this->actingAs($this->member)
        ->get(reportRoute('reports.projects'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('reports/projects')
            ->has('projects', 1)
            ->where('projects.0.consumedSeconds', 9000)
            ->where('projects.0.percent', 25));
});

it('exports the detailed report as CSV for members without amounts', function () {
    $response = $this->actingAs($this->member)
        ->get(reportRoute('reports.export', ['type' => 'detailed', 'format' => 'csv']))
        ->assertOk()
        ->assertDownload();

    $csv = file_get_contents($response->baseResponse->getFile()->getPathname());

    expect($csv)->toContain('Mia Member')
        ->and($csv)->toContain('1,50')
        ->and($csv)->not->toContain('Olivia Owner')
        ->and($csv)->not->toContain(__('Amount (:currency)', ['currency' => 'SEK']));
});

it('exports the summary as XLSX with amounts for owners', function () {
    $response = $this->actingAs($this->owner)
        ->get(reportRoute('reports.export', ['type' => 'summary', 'format' => 'xlsx', 'group' => 'member', 'subgroup' => 'none']))
        ->assertOk()
        ->assertDownload();

    $reader = new Reader;
    $reader->open($response->baseResponse->getFile()->getPathname());
    $rows = [];

    foreach ($reader->getSheetIterator() as $sheet) {
        foreach ($sheet->getRowIterator() as $row) {
            $rows[] = $row->toArray();
        }
    }

    $reader->close();

    expect($rows[0])->toBe([__('Member'), __('Hours'), __('Billable hours'), __('Amount (:currency)', ['currency' => 'SEK'])])
        ->and($rows[1])->toBe(['Mia Member', 1.5, 1.5, 1500])
        ->and(end($rows))->toBe([__('Total'), 2.5, 2.5, 2500]);
});

it('rejects unknown export formats', function () {
    $this->actingAs($this->owner)
        ->get(reportRoute('reports.export', ['type' => 'detailed', 'format' => 'pdf']))
        ->assertSessionHasErrors('format');
});

it('does not show another organization in reports or exports', function () {
    $other = Organization::factory()->create();
    $otherOwner = User::factory()->withoutOrganization()->create(['name' => 'Otto Outsider']);
    $other->members()->attach($otherOwner, ['role' => OrganizationRole::Owner->value]);
    $foreign = Project::factory()->for($other)->create(['name' => 'Hemligt']);
    TimeEntry::factory()->by($otherOwner, $foreign)->between(CarbonImmutable::parse('2026-11-16 08:00'), CarbonImmutable::parse('2026-11-16 18:00'))->create();

    $this->actingAs($this->owner)
        ->get(reportRoute('reports.summary', ['projects' => [$foreign->id, $this->project->id], 'members' => [$otherOwner->id, $this->member->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals.seconds', 5400)
            ->where('options.projects', [['value' => (string) $this->project->id, 'label' => 'Webb · Acme']]));

    $response = $this->actingAs($this->owner)->get(reportRoute('reports.export', ['type' => 'detailed', 'format' => 'csv']));
    $csv = file_get_contents($response->baseResponse->getFile()->getPathname());

    expect($csv)->not->toContain('Otto Outsider')->and($csv)->not->toContain('Hemligt');

    $this->actingAs($otherOwner)
        ->get(reportRoute('reports.summary'))
        ->assertForbidden();
});

it('shows time per member and week on the project page for owners only', function () {
    $this->actingAs($this->owner)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $this->project->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('breakdown.totals.amount', 250000)
            ->has('breakdown.members', 2)
            ->where('breakdown.members.0.label', 'Mia Member')
            ->has('breakdown.weeks', 12)
            ->where('breakdown.weeks.11', ['key' => '2026-11-16', 'seconds' => 9000, 'billableSeconds' => 9000]));

    $this->actingAs($this->member)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $this->project->id]))
        ->assertInertia(fn (Assert $page) => $page->where('breakdown', null));
});

it('shows time for a period on the client page', function () {
    $this->actingAs($this->owner)
        ->get(route('clients.show', ['current_organization' => $this->slug, 'client' => $this->client->id, 'period' => 'this_week']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.period', 'this_week')
            ->where('report.totals.seconds', 9000)
            ->where('report.projects.0.name', 'Webb'));

    $this->actingAs($this->owner)
        ->get(route('clients.show', ['current_organization' => $this->slug, 'client' => $this->client->id, 'period' => 'last_month']))
        ->assertInertia(fn (Assert $page) => $page->where('report.totals.seconds', 0)->where('report.projects', []));
});
