<?php

namespace App\Actions\Tags;

use App\Models\Tag;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RenameTag
{
    /**
     * Rename a tag. If another tag in the organization already has the new name, the two are merged:
     * this tag's time entries get the other tag and this tag is deleted. Returns the remaining tag.
     *
     * @throws ValidationException
     */
    public function handle(Tag $tag, string $name): Tag
    {
        $name = Tag::clean($name);

        if ($name === '' || mb_strlen($name) > Tag::MAX_NAME_LENGTH) {
            throw ValidationException::withMessages(['name' => __('A tag needs a name of at most :max characters.', ['max' => Tag::MAX_NAME_LENGTH])]);
        }

        $target = Tag::query()
            ->forOrganization($tag->organization_id)
            ->whereKeyNot($tag->id)
            ->get()
            ->first(fn (Tag $other) => Tag::normalize($other->name) === Tag::normalize($name));

        if ($target === null) {
            $tag->update(['name' => $name]);

            return $tag;
        }

        return DB::transaction(function () use ($tag, $target) {
            // Straight from the pivot, so soft-deleted (restorable) entries keep their tag too.
            $entryIds = DB::table('tag_time_entry')->where('tag_id', $tag->id)->pluck('time_entry_id')->all();
            $target->timeEntries()->syncWithoutDetaching($entryIds);
            $tag->delete();

            return $target;
        });
    }
}
