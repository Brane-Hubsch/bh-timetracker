<?php

namespace App\Actions\Tags;

use App\Models\Organization;
use App\Models\Tag;
use Illuminate\Validation\ValidationException;

class CreateTag
{
    public function __construct(private readonly ResolveTags $resolveTags)
    {
        //
    }

    /**
     * Create a tag (or return the existing one with the same name).
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, string $name): Tag
    {
        $tag = $this->resolveTags->handle($organization, [$name], 'name')->first();

        if ($tag === null) {
            throw ValidationException::withMessages(['name' => __('A tag needs a name of at most :max characters.', ['max' => Tag::MAX_NAME_LENGTH])]);
        }

        return $tag;
    }
}
