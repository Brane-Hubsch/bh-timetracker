<?php

namespace App\Http\Controllers\Tags;

use App\Actions\Tags\CreateTag;
use App\Actions\Tags\DeleteTag;
use App\Actions\Tags\RenameTag;
use App\Http\Controllers\Controller;
use App\Models\Tag;
use App\Models\User;
use App\Support\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The organization's tag list (owners and admins): usage per tag, add, rename (renaming to an
 * existing name merges) and delete. Members create tags while reporting time.
 */
class TagController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function index(#[CurrentUser] User $user): Response
    {
        $organization = $this->currentOrganization->getOrFail();
        Gate::authorize('manage', [Tag::class, $organization]);

        $tags = Tag::query()
            ->forOrganization($organization)
            ->withCount('timeEntries')
            ->withSum('timeEntries as reported_seconds', 'duration_seconds')
            ->withMax('timeEntries as last_used_at', 'started_at')
            ->get()
            ->sortBy(fn (Tag $tag) => mb_strtolower($tag->name))
            ->map(fn (Tag $tag) => [
                'id' => $tag->id,
                'name' => $tag->name,
                'entryCount' => $tag->time_entries_count ?? 0,
                'reportedSeconds' => is_numeric($seconds = $tag->getAttribute('reported_seconds')) ? (int) $seconds : 0,
                // The local date the tag was last used on, in the viewer's time zone.
                'lastUsedOn' => is_string($lastUsed = $tag->getAttribute('last_used_at'))
                    ? CarbonImmutable::parse($lastUsed, 'UTC')->setTimezone($user->timezone)->toDateString()
                    : null,
            ])
            ->values();

        return Inertia::render('tags/index', ['tags' => $tags]);
    }

    public function store(Request $request, CreateTag $createTag): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();
        Gate::authorize('manage', [Tag::class, $organization]);
        $request->validate(['name' => ['required', 'string', 'max:'.Tag::MAX_NAME_LENGTH]]);

        $createTag->handle($organization, $request->string('name')->value());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Tag added.')]);

        return back();
    }

    public function update(Request $request, Tag $tag, RenameTag $renameTag): RedirectResponse
    {
        Gate::authorize('update', $tag);
        $request->validate(['name' => ['required', 'string', 'max:'.Tag::MAX_NAME_LENGTH]]);

        $remaining = $renameTag->handle($tag, $request->string('name')->value());

        Inertia::flash('toast', ['type' => 'success', 'message' => $remaining->is($tag) ? __('Tag renamed.') : __('The tags were merged.')]);

        return back();
    }

    public function destroy(Tag $tag, DeleteTag $deleteTag): RedirectResponse
    {
        Gate::authorize('delete', $tag);

        $deleteTag->handle($tag);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Tag deleted.')]);

        return back();
    }
}
