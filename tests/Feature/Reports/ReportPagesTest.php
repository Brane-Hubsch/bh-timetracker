<?php

use App\Enums\OrganizationRole;
use App\Enums\ReportGrouping;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reports\ReportExporter;
use App\Services\Reports\ReportFilters;
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

it('stacks daily and weekly report hours by reported project', function () {
    $internal = Project::factory()->for($this->organization)->create(['name' => 'Intern', 'color' => '#059669']);
    TimeEntry::factory()->by($this->member, $internal)
        ->between(CarbonImmutable::parse('2026-11-15 23:30', 'UTC'), CarbonImmutable::parse('2026-11-16 00:00', 'UTC'))
        ->create(['is_billable' => false]);
    TimeEntry::factory()->by($this->member, $this->project)
        ->between(CarbonImmutable::parse('2026-11-16 10:00', 'UTC'), CarbonImmutable::parse('2026-11-16 10:30', 'UTC'))
        ->create(['is_billable' => false]);

    $this->actingAs($this->member)
        ->get(reportRoute('reports.summary', ['group' => 'tag']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.timeline.unit', 'day')
            ->where('summary.timeline.projects', [
                ['id' => $this->project->id, 'name' => 'Webb', 'clientName' => 'Acme', 'color' => $this->project->color],
                ['id' => $internal->id, 'name' => 'Intern', 'clientName' => null, 'color' => '#059669'],
            ])
            ->where('summary.timeline.buckets.15.key', '2026-11-16')
            ->where('summary.timeline.buckets.15.seconds', 9000)
            ->where('summary.timeline.buckets.15.projectSeconds', [$this->project->id => 7200, $internal->id => 1800])
            ->missing('summary.timeline.buckets.16.projectSeconds'));

    $this->actingAs($this->member)
        ->get(reportRoute('reports.summary', ['period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-11-30', 'projects' => [$internal->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.timeline.unit', 'week')
            ->has('summary.timeline.projects', 1)
            ->where('summary.timeline.projects.0.id', $internal->id)
            ->where('summary.timeline.buckets.7.key', '2026-11-16')
            ->where('summary.timeline.buckets.7.projectSeconds', [$internal->id => 1800]));
});

it('gives the filters member pictures, inactive members and client logos', function () {
    $this->owner->update(['avatar_url' => 'https://lh3.googleusercontent.com/olivia.jpg']);
    $this->organization->members()->updateExistingPivot($this->member->id, ['deactivated_at' => now()]);
    $this->client->update(['logo_path' => 'images/logos/acme']);

    $this->actingAs($this->owner)
        ->get(reportRoute('reports.summary'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('options.members.0.label', 'Mia Member (inaktiv)')
            ->where('options.members.0.isInactive', true)
            ->where('options.members.1.avatar', 'https://lh3.googleusercontent.com/olivia.jpg')
            ->where('options.members.1.isInactive', false)
            ->where('options.clients.0.logo', fn (string $url) => str_ends_with($url, 'images/logos/acme/64.webp')));
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

it('exports the summary and the detailed report as PDF', function (string $type) {
    $response = $this->actingAs($this->owner)
        ->get(reportRoute('reports.export', ['type' => $type, 'format' => 'pdf']))
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');

    expect($response->headers->get('Content-Disposition'))->toContain('.pdf')
        ->and($response->getContent())->toStartWith('%PDF');
})->with(['summary', 'detailed']);

it('builds PDF documents with amounts and the whole team for owners', function () {
    $exporter = app(ReportExporter::class);
    $filters = new ReportFilters($this->organization, $this->owner, CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30'));

    $summary = $exporter->summaryDocument($filters, ReportGrouping::Member, null)->render();
    $detailed = $exporter->detailedDocument($filters, 'date', 'desc')->render();

    expect($summary)->toContain('Mia Member', 'Olivia Owner', '1,5 h', '2,5 h', __('Amount'))
        ->and($detailed)->toContain('Mia Member', 'Olivia Owner', 'Kodning', __('Amount'));
});

it('builds PDF documents with only their own time and no amounts for members', function () {
    $exporter = app(ReportExporter::class);
    // A member asking for someone else's time still only gets their own.
    $filters = new ReportFilters($this->organization, $this->member, CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30'), userIds: [$this->owner->id]);

    foreach ([
        $exporter->summaryDocument($filters, ReportGrouping::Member, null)->render(),
        $exporter->detailedDocument($filters, 'date', 'desc')->render(),
    ] as $document) {
        expect($document)->toContain('Mia Member', '1,5 h')
            ->and($document)->not->toContain('Olivia Owner')
            ->and($document)->not->toContain(__('Amount'));
    }
});

it('adds hours per day and time per project charts to the PDF documents', function () {
    $exporter = app(ReportExporter::class);
    $filters = new ReportFilters($this->organization, $this->owner, CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30'));

    $summary = $exporter->summaryDocument($filters, ReportGrouping::Client, ReportGrouping::Project)->render();
    $detailed = $exporter->detailedDocument($filters, 'date', 'desc')->render();

    expect($summary)->toContain(__('Hours per day'), __('Time per project'), '100 %')
        ->and($detailed)->toContain(__('Hours per day'))
        ->and($detailed)->not->toContain(__('Time per project'));
});

it('keeps the folded "Other projects" row last in the PDF chart', function () {
    foreach (range(1, 9) as $number) {
        $project = Project::factory()->for($this->organization)->create(['name' => "Extra {$number}"]);
        TimeEntry::factory()->by($this->owner, $project)
            ->between(CarbonImmutable::parse('2026-11-10 08:00'), CarbonImmutable::parse('2026-11-10 08:00')->addMinutes(10 + $number))
            ->create();
    }

    $document = app(ReportExporter::class)->summaryDocument(
        new ReportFilters($this->organization, $this->owner, CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30')),
        ReportGrouping::Member,
        null,
    )->render();
    $other = __('Other projects (:count)', ['count' => 3]);

    expect($document)->toContain($other, 'Extra 4')
        ->and($document)->not->toContain('Extra 3')
        ->and(strpos($document, $other))->toBeGreaterThan(strpos($document, 'Extra 4'));
});

it('rejects unknown export formats', function () {
    $this->actingAs($this->owner)
        ->get(reportRoute('reports.export', ['type' => 'detailed', 'format' => 'docx']))
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
            ->has('summary.timeline.projects', 1)
            ->where('summary.timeline.projects.0.id', $this->project->id)
            ->where('options.projects', [[
                'value' => (string) $this->project->id,
                'label' => 'Webb · Acme',
                'name' => 'Webb',
                'client' => 'Acme',
                'color' => $this->project->color,
            ]]));

    $response = $this->actingAs($this->owner)->get(reportRoute('reports.export', ['type' => 'detailed', 'format' => 'csv']));
    $csv = file_get_contents($response->baseResponse->getFile()->getPathname());

    expect($csv)->not->toContain('Otto Outsider')->and($csv)->not->toContain('Hemligt');

    // Filter names in the PDF header are looked up within the organization only.
    $document = app(ReportExporter::class)->detailedDocument(
        new ReportFilters($this->organization, $this->owner, null, null, userIds: [$otherOwner->id, $this->member->id], projectIds: [$foreign->id, $this->project->id]),
        'date',
        'desc',
    )->render();

    expect($document)->not->toContain('Otto Outsider')->and($document)->not->toContain('Hemligt')->and($document)->toContain('Webb');

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
