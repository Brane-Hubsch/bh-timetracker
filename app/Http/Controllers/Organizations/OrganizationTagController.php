<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Tags\CreateTag;
use App\Actions\Tags\DeleteTag;
use App\Actions\Tags\RenameTag;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * The organization's tag list (owners and admins). Members create tags while reporting time.
 */
class OrganizationTagController extends Controller
{
    public function store(Request $request, Organization $organization, CreateTag $createTag): RedirectResponse
    {
        Gate::authorize('manage', [Tag::class, $organization]);
        $request->validate(['name' => ['required', 'string', 'max:'.Tag::MAX_NAME_LENGTH]]);

        $createTag->handle($organization, $request->string('name')->value());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Tag added.')]);

        return back();
    }

    public function update(Request $request, Organization $organization, Tag $tag, RenameTag $renameTag): RedirectResponse
    {
        Gate::authorize('update', $tag);
        $request->validate(['name' => ['required', 'string', 'max:'.Tag::MAX_NAME_LENGTH]]);

        $remaining = $renameTag->handle($tag, $request->string('name')->value());

        Inertia::flash('toast', ['type' => 'success', 'message' => $remaining->is($tag) ? __('Tag renamed.') : __('The tags were merged.')]);

        return back();
    }

    public function destroy(Organization $organization, Tag $tag, DeleteTag $deleteTag): RedirectResponse
    {
        Gate::authorize('delete', $tag);

        $deleteTag->handle($tag);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Tag deleted.')]);

        return back();
    }
}
