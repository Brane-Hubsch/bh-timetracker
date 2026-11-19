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

function orgTagRoute(string $name, array $parameters = []): string
{
    return route($name, ['organization' => test()->organization->slug, ...$parameters]);
}

it('shows the tag list with usage to owners and admins only', function () {
    $tag = Tag::factory()->for($this->organization)->create(['name' => 'Möte']);
    TimeEntry::factory()->count(2)->create(['organization_id' => $this->organization->id])
        ->each(fn (TimeEntry $entry) => $entry->tags()->attach($tag));
    Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->owner)
        ->get(orgTagRoute('organizations.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tags', [['id' => $tag->id, 'name' => 'Möte', 'entryCount' => 2]])
            ->where('permissions.canManageTags', true));

    $this->actingAs($this->member)
        ->get(orgTagRoute('organizations.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tags', null)
            ->where('permissions.canManageTags', false));
});

it('lets owners add, rename, merge and delete tags', function () {
    $this->actingAs($this->owner)
        ->post(orgTagRoute('organizations.tags.store'), ['name' => 'Mote'])
        ->assertSessionHasNoErrors();
    $tag = Tag::query()->forOrganization($this->organization)->sole();

    $this->actingAs($this->owner)
        ->patch(orgTagRoute('organizations.tags.update', ['tag' => $tag->id]), ['name' => 'Möte'])
        ->assertSessionHasNoErrors();
    expect($tag->fresh()->name)->toBe('Möte');

    $other = Tag::factory()->for($this->organization)->create(['name' => 'Möten']);
    $this->actingAs($this->owner)
        ->patch(orgTagRoute('organizations.tags.update', ['tag' => $other->id]), ['name' => 'möte'])
        ->assertSessionHasNoErrors();
    expect(Tag::query()->forOrganization($this->organization)->pluck('name')->all())->toBe(['Möte']);

    $this->actingAs($this->owner)
        ->delete(orgTagRoute('organizations.tags.destroy', ['tag' => $tag->id]))
        ->assertSessionHasNoErrors();
    expect(Tag::query()->forOrganization($this->organization)->count())->toBe(0);
});

it('validates the tag name', function () {
    $this->actingAs($this->owner)
        ->post(orgTagRoute('organizations.tags.store'), ['name' => str_repeat('a', 51)])
        ->assertSessionHasErrors('name');
});

it('keeps members from managing tags', function () {
    $tag = Tag::factory()->for($this->organization)->create();

    $this->actingAs($this->member)->post(orgTagRoute('organizations.tags.store'), ['name' => 'Ny'])->assertForbidden();
    $this->actingAs($this->member)->patch(orgTagRoute('organizations.tags.update', ['tag' => $tag->id]), ['name' => 'Ny'])->assertForbidden();
    $this->actingAs($this->member)->delete(orgTagRoute('organizations.tags.destroy', ['tag' => $tag->id]))->assertForbidden();

    expect($tag->fresh()->name)->not->toBe('Ny');
});

it('does not reach another organization\'s tags', function () {
    $foreign = Tag::factory()->create(['name' => 'Hemlig']);

    $this->actingAs($this->owner)
        ->patch(orgTagRoute('organizations.tags.update', ['tag' => $foreign->id]), ['name' => 'Kapad'])
        ->assertNotFound();
    $this->actingAs($this->owner)
        ->delete(orgTagRoute('organizations.tags.destroy', ['tag' => $foreign->id]))
        ->assertNotFound();

    expect($foreign->fresh()->name)->toBe('Hemlig');
});
