<?php

namespace App\Actions\Tags;

use App\Models\Organization;
use App\Models\Tag;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ResolveTags
{
    /**
     * Find the organization's tags with these names, creating the ones that don't exist yet (anyone
     * who reports time may add tags). Names are trimmed and compared case-insensitively, so "möte"
     * finds an existing "Möte"; duplicates and empty names are ignored.
     *
     * @param  array<int, string>  $names
     * @return Collection<int, Tag>
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, array $names, string $errorKey = 'tags', ?int $max = null): Collection
    {
        $wanted = collect($names)
            ->map(fn (string $name) => Tag::clean($name))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Tag::normalize($name))
            ->values();

        if ($wanted->contains(fn (string $name) => mb_strlen($name) > Tag::MAX_NAME_LENGTH)) {
            throw ValidationException::withMessages([$errorKey => __('A tag can be at most :max characters.', ['max' => Tag::MAX_NAME_LENGTH])]);
        }

        if ($max !== null && $wanted->count() > $max) {
            throw ValidationException::withMessages([$errorKey => __('A time entry can have at most :max tags.', ['max' => $max])]);
        }

        if ($wanted->isEmpty()) {
            return new Collection;
        }

        $existing = Tag::query()->forOrganization($organization)->get()
            ->keyBy(fn (Tag $tag) => Tag::normalize($tag->name));

        return $wanted->map(fn (string $name) => $existing->get(Tag::normalize($name))
            ?? Tag::create(['organization_id' => $organization->id, 'name' => $name]));
    }
}
