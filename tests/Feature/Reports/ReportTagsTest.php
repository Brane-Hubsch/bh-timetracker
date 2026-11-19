<?php

use App\Enums\OrganizationRole;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create(['name' => 'Webb']);
    $this->meeting = Tag::factory()->for($this->organization)->create(['name' => 'Möte']);
    $this->bug = Tag::factory()->for($this->organization)->create(['name' => 'Buggfix']);

    $add = function (User $user, string $start, int $minutes, array $tags) {
        $entry = TimeEntry::factory()->by($user, $this->project)
            ->between(CarbonImmutable::parse($start), CarbonImmutable::parse($start)->addMinutes($minutes))
            ->create(['description' => 'Arbete']);
        $entry->tags()->attach($tags);

        return $entry;
    };

    // Owner: 60 min Möte + Buggfix, 30 min Möte; member: 90 min without tags.
    $add($this->owner, '2026-11-16 08:00', 60, [$this->meeting->id, $this->bug->id]);
    $add($this->owner, '2026-11-17 08:00', 30, [$this->meeting->id]);
    $add($this->member, '2026-11-16 10:00', 90, []);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function tagReportRoute(string $name, array $query = []): string
{
    return route($name, ['current_organization' => test()->organization->slug, ...$query]);
}

it('groups the summary by tag, counting an entry under each of its tags', function () {
    $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.summary', ['group' => 'tag', 'subgroup' => 'none']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals.seconds', 10800)
            // Ties are ordered by name.
            ->where('summary.groups.0.label', 'Möte')
            ->where('summary.groups.0.seconds', 5400)
            ->where('summary.groups.1.label', 'Utan tagg')
            ->where('summary.groups.1.seconds', 5400)
            ->where('summary.groups.2.label', 'Buggfix')
            ->where('summary.groups.2.seconds', 3600)
            ->where('options.tags', [
                ['value' => (string) $this->bug->id, 'label' => 'Buggfix'],
                ['value' => (string) $this->meeting->id, 'label' => 'Möte'],
            ]));
});

it('filters on any of the selected tags', function () {
    $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.summary', ['tags' => [$this->bug->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals.seconds', 3600)
            ->where('filters.tags', [(string) $this->bug->id]));

    $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.summary', ['tags' => [$this->bug->id, $this->meeting->id]]))
        ->assertInertia(fn (Assert $page) => $page->where('summary.totals.seconds', 5400));
});

it('shows tags in the detailed report and its CSV export', function () {
    $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.detailed', ['sort' => 'date', 'direction' => 'asc']))
        ->assertInertia(fn (Assert $page) => $page->where('entries.data.0.tags', ['Buggfix', 'Möte']));

    $response = $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.export', ['type' => 'detailed', 'format' => 'csv', 'sort' => 'date', 'direction' => 'asc']))
        ->assertOk();
    $csv = file_get_contents($response->baseResponse->getFile()->getPathname());

    expect($csv)->toContain(__('Tags'))->and($csv)->toContain('Buggfix, Möte');
});

it('keeps members to their own time when filtering or grouping by tag', function () {
    $this->actingAs($this->member)
        ->get(tagReportRoute('reports.summary', ['group' => 'tag', 'subgroup' => 'none']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals.seconds', 5400)
            ->has('summary.groups', 1)
            ->where('summary.groups.0.label', 'Utan tagg'));

    $this->actingAs($this->member)
        ->get(tagReportRoute('reports.summary', ['tags' => [$this->meeting->id]]))
        ->assertInertia(fn (Assert $page) => $page->where('summary.totals.seconds', 0));
});

it('ignores tags from another organization', function () {
    $foreign = Tag::factory()->create(['name' => 'Hemlig']);
    $foreignEntry = TimeEntry::factory()->create(['organization_id' => $foreign->organization_id]);
    $foreignEntry->tags()->attach($foreign);

    $this->actingAs($this->owner)
        ->get(tagReportRoute('reports.summary', ['tags' => [$foreign->id]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.totals.seconds', 0)
            ->where('options.tags', fn ($tags) => collect($tags)->pluck('label')->doesntContain('Hemlig')));
});
