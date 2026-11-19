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

    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create();
});

afterEach(fn () => CarbonImmutable::setTestNow());

function tagRoute(string $name, array $parameters = []): string
{
    return route($name, ['current_organization' => test()->organization->slug, ...$parameters]);
}

function taggedPayload(array $overrides = []): array
{
    return [
        'project_id' => test()->project->id,
        'date' => '2026-11-18',
        'start' => '09:00',
        'end' => '10:00',
        ...$overrides,
    ];
}

it('lets members tag their time, reusing tags case-insensitively and creating new ones', function () {
    Tag::factory()->for($this->organization)->create(['name' => 'Möte']);

    $this->actingAs($this->member)
        ->post(tagRoute('time.store'), taggedPayload(['tags' => ['möte', 'Kundsupport']]))
        ->assertSessionHasNoErrors();

    $entry = TimeEntry::query()->sole();

    expect($entry->tags()->pluck('name')->all())->toBe(['Kundsupport', 'Möte'])
        ->and(Tag::query()->forOrganization($this->organization)->count())->toBe(2);
});

it('replaces the tags when given and keeps them when left out', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)->create();
    $entry->tags()->attach(Tag::factory()->for($this->organization)->create(['name' => 'Gammal']));

    $this->actingAs($this->member)
        ->patch(tagRoute('time.update', ['timeEntry' => $entry->id]), taggedPayload(['description' => 'Utan taggfält']))
        ->assertSessionHasNoErrors();
    expect($entry->tags()->pluck('name')->all())->toBe(['Gammal']);

    $this->actingAs($this->member)
        ->patch(tagRoute('time.update', ['timeEntry' => $entry->id]), taggedPayload(['tags' => ['Ny']]))
        ->assertSessionHasNoErrors();
    expect($entry->tags()->pluck('name')->all())->toBe(['Ny']);

    $this->actingAs($this->member)
        ->patch(tagRoute('time.update', ['timeEntry' => $entry->id]), taggedPayload(['tags' => []]))
        ->assertSessionHasNoErrors();
    expect($entry->tags()->count())->toBe(0);
});

it('limits the number and length of tags', function (array $tags) {
    $this->actingAs($this->member)
        ->post(tagRoute('time.store'), taggedPayload(['tags' => $tags]))
        ->assertSessionHasErrors('tags*');

    expect(TimeEntry::query()->count())->toBe(0)
        ->and(Tag::query()->forOrganization($this->organization)->count())->toBe(0);
})->with([
    'too many' => [array_map(fn (int $number) => "Tagg {$number}", range(1, 11))],
    'too long' => [[str_repeat('a', 51)]],
]);

it('never attaches a tag from another organization', function () {
    $foreign = Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->member)
        ->post(tagRoute('time.store'), taggedPayload(['tags' => ['Hemlig']]))
        ->assertSessionHasNoErrors();

    $tag = TimeEntry::query()->sole()->tags()->sole();

    expect($tag->is($foreign))->toBeFalse()
        ->and($tag->organization_id)->toBe($this->organization->id);
});

it('copies the tags with the entries to the following week', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)
        ->between(CarbonImmutable::parse('2026-11-09 08:00'), CarbonImmutable::parse('2026-11-09 09:00'))
        ->create();
    $entry->tags()->attach(Tag::factory()->for($this->organization)->create(['name' => 'Möte']));

    $this->actingAs($this->member)
        ->post(tagRoute('time.copy'), ['entry_ids' => [$entry->id]])
        ->assertSessionHasNoErrors();

    $copy = TimeEntry::query()->whereKeyNot($entry->id)->sole();

    expect($copy->tags()->pluck('name')->all())->toBe(['Möte']);
});

it('shows entry tags and the organization\'s tags on the time page', function () {
    $entry = TimeEntry::factory()->by($this->member, $this->project)
        ->between(CarbonImmutable::parse('2026-11-17 08:00'), CarbonImmutable::parse('2026-11-17 09:00'))
        ->create();
    $entry->tags()->attach(Tag::factory()->for($this->organization)->create(['name' => 'Möte']));
    Tag::factory()->for($this->organization)->create(['name' => 'Buggfix']);
    Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->member)
        ->get(tagRoute('time.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('entries.0.tags', ['Möte'])
            ->where('tags', ['Buggfix', 'Möte'])
            ->where('recentTags', ['Möte']));
});

it('provides the ten most recently used organization tags as shortcuts', function (string $route) {
    $tags = [];
    $entries = TimeEntry::factory()->by($this->member, $this->project);
    $firstDay = CarbonImmutable::parse('2026-11-04 09:00', 'UTC');

    foreach (range(1, 11) as $number) {
        $tags[$number] = Tag::factory()->for($this->organization)->create(['name' => "Tagg {$number}"]);
        $start = $firstDay->addDays($number);
        $entries->create(['started_at' => $start, 'ended_at' => $start->addHour()])
            ->tags()->attach($tags[$number]);
    }

    TimeEntry::factory()->by($this->owner, $this->project)
        ->between('2026-11-17 09:00', '2026-11-17 10:00')->create()
        ->tags()->attach($tags[1]);

    $deleted = $entries->between('2026-11-18 09:00', '2026-11-18 10:00')->create();
    $deleted->tags()->attach($tags[2]);
    $deleted->delete();

    Tag::factory()->for($this->organization)->create(['name' => 'Oanvänd']);
    $foreignEntry = TimeEntry::factory()->between('2026-11-18 09:00', '2026-11-18 10:00')->create();
    $foreignEntry->tags()->attach(Tag::factory()->for($foreignEntry->organization)->create(['name' => 'Hemlig']));

    $this->actingAs($this->member)
        ->get(tagRoute($route))
        ->assertInertia(fn (Assert $page) => $page
            ->where('recentTags', array_map(fn (int $number) => "Tagg {$number}", [1, ...range(11, 3)]))
            ->has('tags', 12));
})->with(['time.index', 'dashboard']);
