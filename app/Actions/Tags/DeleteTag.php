<?php

namespace App\Actions\Tags;

use App\Models\Tag;

class DeleteTag
{
    /**
     * Delete a tag. It is removed from its time entries; the entries themselves are kept.
     */
    public function handle(Tag $tag): void
    {
        $tag->delete();
    }
}
