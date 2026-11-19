<?php

use App\Actions\Tags\CreateTag;
use App\Actions\Tags\DeleteTag;
use App\Actions\Tags\RenameTag;
use App\Actions\Tags\ResolveTags;
use App\Models\Organization;
use App\Models\Tag;
use App\Models\TimeEntry;
use Illuminate\Validation\ValidationException;

it('finds existing tags case-insensitively and creates the missing ones', function () {
    $organization = Organization::factory()->create();
    $meeting = Tag::factory()->for($organization)->create(['name' => 'Möte']);

    $tags = app(ResolveTags::class)->handle($organization, ['  möte ', 'Buggfix', 'BUGGFIX', '', 'Code  review']);

    expect($tags->pluck('name')->all())->toBe(['Möte', 'Buggfix', 'Code review'])
        ->and($tags->first()->is($meeting))->toBeTrue()
        ->and(Tag::query()->forOrganization($organization)->count())->toBe(3);
});

it('never reuses a tag from another organization', function () {
    $organization = Organization::factory()->create();
    $foreign = Tag::factory()->create(['name' => 'Möte']);

    $tag = app(ResolveTags::class)->handle($organization, ['Möte'])->sole();

    expect($tag->is($foreign))->toBeFalse()
        ->and($tag->organization_id)->toBe($organization->id);
});

it('rejects tag names that are too long', function () {
    app(ResolveTags::class)->handle(Organization::factory()->create(), [str_repeat('a', 51)]);
})->throws(ValidationException::class);

it('creates a tag or returns the existing one', function () {
    $organization = Organization::factory()->create();

    $first = app(CreateTag::class)->handle($organization, 'Resa');
    $second = app(CreateTag::class)->handle($organization, 'resa');

    expect($second->is($first))->toBeTrue();
});

it('renames a tag', function () {
    $tag = Tag::factory()->create(['name' => 'Mote']);

    app(RenameTag::class)->handle($tag, ' Möte ');

    expect($tag->fresh()->name)->toBe('Möte');
});

it('merges into an existing tag when renamed to its name, including deleted entries', function () {
    $organization = Organization::factory()->create();
    $meeting = Tag::factory()->for($organization)->create(['name' => 'Möte']);
    $duplicate = Tag::factory()->for($organization)->create(['name' => 'Möten']);
    [$both, $onlyDuplicate, $deleted] = TimeEntry::factory()->count(3)->create(['organization_id' => $organization->id]);
    $both->tags()->attach([$meeting->id, $duplicate->id]);
    $onlyDuplicate->tags()->attach($duplicate);
    $deleted->tags()->attach($duplicate);
    $deleted->delete();

    $remaining = app(RenameTag::class)->handle($duplicate, 'möte');

    expect($remaining->is($meeting))->toBeTrue()
        ->and(Tag::query()->forOrganization($organization)->pluck('name')->all())->toBe(['Möte'])
        ->and($onlyDuplicate->tags()->pluck('name')->all())->toBe(['Möte'])
        ->and($both->tags()->count())->toBe(1)
        ->and($deleted->tags()->pluck('name')->all())->toBe(['Möte']);
});

it('deletes a tag but keeps its time entries', function () {
    $tag = Tag::factory()->create();
    $entry = TimeEntry::factory()->create(['organization_id' => $tag->organization_id]);
    $entry->tags()->attach($tag);

    app(DeleteTag::class)->handle($tag);

    expect(Tag::query()->forOrganization($tag->organization_id)->count())->toBe(0)
        ->and($entry->fresh())->not->toBeNull()
        ->and($entry->tags()->count())->toBe(0);
});
