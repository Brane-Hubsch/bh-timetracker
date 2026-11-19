<?php

namespace App\Http\Controllers\TimeEntries;

use App\Actions\TimeEntries\CreateTimeEntries;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Actions\TimeEntries\DeleteTimeEntry;
use App\Actions\TimeEntries\RestoreTimeEntry;
use App\Actions\TimeEntries\UpdateTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\OrganizationPermission;
use App\Http\Controllers\Controller;
use App\Http\Requests\TimeEntries\CopyTimeEntriesRequest;
use App\Http\Requests\TimeEntries\TimeEntryRequest;
use App\Models\Organization;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\CurrentOrganization;
use App\Support\TimeEntryPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Time reporting: a week of the selected member's entries, shown as a list or calendar.
 */
class TimeEntryController extends Controller
{
    public function __construct(
        private readonly CurrentOrganization $currentOrganization,
        private readonly TimeEntryPresenter $presenter,
    ) {
        //
    }

    public function index(Request $request, #[CurrentUser] User $user): Response
    {
        $organization = $this->currentOrganization->getOrFail();
        $member = $this->selectedMember($request, $user, $organization);
        $timezone = $user->timezone;

        $date = $this->parseDate($request->string('date')->value(), $timezone);
        $weekStart = $this->presenter->weekStart($date, $organization);
        $weekEnd = $weekStart->addWeek();

        $entries = TimeEntry::query()
            ->where('user_id', $member->id)
            ->startingBetween($weekStart, $weekEnd)
            ->with(['project.client', 'tags'])
            ->orderBy('started_at')
            ->get();

        $previousWeekStart = $weekStart->subWeek();

        $members = $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime)
            ? $this->presenter->memberOptions($organization)
            : [];

        return Inertia::render('time/index', [
            'date' => $date->toDateString(),
            'today' => CarbonImmutable::now($timezone)->toDateString(),
            'weekStart' => $weekStart->toDateString(),
            'weekStartsOn' => $organization->week_starts_on,
            'timezone' => $timezone,
            'entries' => $entries->map(fn (TimeEntry $entry) => $this->presenter->entry($entry, $timezone)),
            'projects' => $this->presenter->projectOptions($organization, $member),
            'tags' => $this->presenter->tagOptions($organization),
            'member' => ['id' => $member->id, 'name' => $member->name],
            // Owners and admins can switch to another member's time.
            'members' => $members,
            // So the entry form's project shortcuts follow the member it reports for.
            'recentProjects' => $this->presenter->recentProjectsByMember($organization, $members),
            // Loaded on demand for "copy previous week".
            'previousWeek' => Inertia::optional(fn () => TimeEntry::query()
                ->where('user_id', $member->id)
                ->startingBetween($previousWeekStart, $weekStart)
                ->with(['project.client', 'tags'])
                ->orderBy('started_at')
                ->get()
                ->map(fn (TimeEntry $entry) => $this->presenter->entry($entry, $timezone))),
        ]);
    }

    public function store(TimeEntryRequest $request, #[CurrentUser] User $user, CreateTimeEntry $createTimeEntry): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();
        $data = $request->timeEntryData($user);
        $this->authorizeMember($user, $organization, $data->userId);

        $createTimeEntry->handle($organization, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Time saved.')]);

        return back();
    }

    public function update(TimeEntryRequest $request, #[CurrentUser] User $user, TimeEntry $timeEntry, UpdateTimeEntry $updateTimeEntry): RedirectResponse
    {
        Gate::authorize('update', $timeEntry);

        $data = $request->timeEntryData($timeEntry->user);
        $this->authorizeMember($user, $timeEntry->organization, $data->userId);

        $updateTimeEntry->handle($timeEntry, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Time updated.')]);

        return back();
    }

    public function destroy(TimeEntry $timeEntry, DeleteTimeEntry $deleteTimeEntry): RedirectResponse
    {
        Gate::authorize('delete', $timeEntry);

        $deleteTimeEntry->handle($timeEntry);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Time entry deleted.'),
            'undo' => route('time.restore', ['timeEntry' => $timeEntry->id]),
        ]);

        return back();
    }

    public function restore(TimeEntry $timeEntry, RestoreTimeEntry $restoreTimeEntry): RedirectResponse
    {
        Gate::authorize('restore', $timeEntry);

        $restoreTimeEntry->handle($timeEntry);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Time entry restored.')]);

        return back();
    }

    /**
     * Copy selected entries from a week to the following week (the user confirmed the draft).
     */
    public function copy(CopyTimeEntriesRequest $request, #[CurrentUser] User $user, CreateTimeEntries $createTimeEntries): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();

        $sources = TimeEntry::query()->whereKey($request->entryIds())->with(['organization', 'tags'])->get();
        abort_if($sources->count() !== count($request->entryIds()), 404);

        $data = $sources->map(function (TimeEntry $entry) use ($user, $organization) {
            Gate::authorize('view', $entry);
            $this->authorizeMember($user, $organization, $entry->user_id);

            return new TimeEntryData(
                userId: $entry->user_id,
                projectId: $entry->project_id,
                startedAt: $entry->started_at->addWeek(),
                endedAt: $entry->ended_at->addWeek(),
                description: $entry->description,
                isBillable: $entry->is_billable,
                tags: $entry->tagNames(),
            );
        })->all();

        $created = $createTimeEntries->handle($organization, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice(':count entry copied.|:count entries copied.', $created->count(), ['count' => $created->count()])]);

        return back();
    }

    private function selectedMember(Request $request, User $user, Organization $organization): User
    {
        if (! $request->filled('user') || $request->integer('user') === $user->id) {
            return $user;
        }

        $member = $organization->members()->wherePivotNull('deactivated_at')->whereKey($request->integer('user'))->first();

        abort_unless($member instanceof User && $user->can('manageFor', [TimeEntry::class, $organization, $member]), 403);

        return $member;
    }

    private function authorizeMember(User $user, Organization $organization, int $memberId): void
    {
        $member = User::find($memberId);

        abort_unless($member && Gate::forUser($user)->allows('manageFor', [TimeEntry::class, $organization, $member]), 403);
    }

    private function parseDate(string $value, string $timezone): CarbonImmutable
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return CarbonImmutable::parse($value, $timezone)->startOfDay();
        }

        return CarbonImmutable::now($timezone)->startOfDay();
    }
}
