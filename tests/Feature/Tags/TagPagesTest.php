<?php

use App\Enums\OrganizationRole;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
});

function tagPageRoute(string $name, array $parameters = []): string
{
    return route($name, ['current_organization' => test()->organization->slug, ...$parameters]);
}

it('shows the tag list with usage to owners and admins only', function () {
    $this->owner->update(['timezone' => 'Europe/Stockholm']);
    $tag = Tag::factory()->for($this->organization)->create(['name' => 'Möte']);
    Tag::factory()->for($this->organization)->create(['name' => 'Arkiv']);
    TimeEntry::factory()->create(['organization_id' => $this->organization->id, 'started_at' => '2026-11-02 08:00:00', 'ended_at' => '2026-11-02 10:00:00', 'duration_seconds' => 7200])
        ->tags()->attach($tag);
    // 23:30 UTC is already the next day in Stockholm.
    TimeEntry::factory()->create(['organization_id' => $this->organization->id, 'started_at' => '2026-11-05 23:30:00', 'ended_at' => '2026-11-06 00:30:00', 'duration_seconds' => 3600])
        ->tags()->attach($tag);
    Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->owner)
        ->get(tagPageRoute('tags.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tags/index')
            ->where('tags', [
                ['id' => Tag::query()->where('name', 'Arkiv')->value('id'), 'name' => 'Arkiv', 'entryCount' => 0, 'reportedSeconds' => 0, 'lastUsedOn' => null],
                ['id' => $tag->id, 'name' => 'Möte', 'entryCount' => 2, 'reportedSeconds' => 10800, 'lastUsedOn' => '2026-11-06'],
            ]));

    $this->actingAs($this->member)->get(tagPageRoute('tags.index'))->assertForbidden();
});

it('lets owners add, rename, merge and delete tags', function () {
    $this->actingAs($this->owner)
        ->post(tagPageRoute('tags.store'), ['name' => 'Mote'])
        ->assertSessionHasNoErrors();
    $tag = Tag::query()->forOrganization($this->organization)->sole();

    $this->actingAs($this->owner)
        ->patch(tagPageRoute('tags.update', ['tag' => $tag->id]), ['name' => 'Möte'])
        ->assertSessionHasNoErrors();
    expect($tag->fresh()->name)->toBe('Möte');

    $other = Tag::factory()->for($this->organization)->create(['name' => 'Möten']);
    $this->actingAs($this->owner)
        ->patch(tagPageRoute('tags.update', ['tag' => $other->id]), ['name' => 'möte'])
        ->assertSessionHasNoErrors();
    expect(Tag::query()->forOrganization($this->organization)->pluck('name')->all())->toBe(['Möte']);

    $this->actingAs($this->owner)
        ->delete(tagPageRoute('tags.destroy', ['tag' => $tag->id]))
        ->assertSessionHasNoErrors();
    expect(Tag::query()->forOrganization($this->organization)->count())->toBe(0);
});

it('validates the tag name', function () {
    $this->actingAs($this->owner)
        ->post(tagPageRoute('tags.store'), ['name' => str_repeat('a', 51)])
        ->assertSessionHasErrors('name');
});

it('keeps members from managing tags', function () {
    $tag = Tag::factory()->for($this->organization)->create();

    $this->actingAs($this->member)->post(tagPageRoute('tags.store'), ['name' => 'Ny'])->assertForbidden();
    $this->actingAs($this->member)->patch(tagPageRoute('tags.update', ['tag' => $tag->id]), ['name' => 'Ny'])->assertForbidden();
    $this->actingAs($this->member)->delete(tagPageRoute('tags.destroy', ['tag' => $tag->id]))->assertForbidden();

    expect($tag->fresh()->name)->not->toBe('Ny');
});

it('does not reach another organization\'s tags', function () {
    $foreign = Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->owner)
        ->patch(tagPageRoute('tags.update', ['tag' => $foreign->id]), ['name' => 'Kapad'])
        ->assertNotFound();
    $this->actingAs($this->owner)
        ->delete(tagPageRoute('tags.destroy', ['tag' => $foreign->id]))
        ->assertNotFound();

    expect($foreign->fresh()->name)->toBe('Hemlig');
});
