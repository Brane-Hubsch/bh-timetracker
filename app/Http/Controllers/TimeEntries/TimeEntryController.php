<?php

namespace App\Http\Controllers\TimeEntries;

use App\Actions\TimeEntries\CopyTimeEntries;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Actions\TimeEntries\DeleteTimeEntry;
use App\Actions\TimeEntries\RestoreTimeEntry;
use App\Actions\TimeEntries\UpdateTimeEntry;
use App\Enums\AbsenceType;
use App\Enums\OrganizationPermission;
use App\Http\Controllers\Controller;
use App\Http\Requests\TimeEntries\CopyTimeEntriesRequest;
use App\Http\Requests\TimeEntries\TimeEntryRequest;
use App\Models\Absence;
use App\Models\Holiday;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\AbsencePresenter;
use App\Support\CurrentOrganization;
use App\Support\HolidayDates;
use App\Support\TimeEntryPresenter;
use App\Support\WorkingDays;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
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

        $view = match (true) {
            $request->routeIs('time.list') => 'list',
            $request->query('view') === 'day' => 'day',
            default => 'week',
        };
        $date = $this->parseDate($request->string('date')->value(), $timezone);
        $membership = $organization->memberships()->where('user_id', $member->id)->first();
        $weekStartsOn = $membership?->week_starts_on;
        $weekStart = $this->presenter->weekStart($date, $organization, $weekStartsOn);
        $weekEnd = $weekStart->addWeek();
        $absenceOptions = $this->absenceOptions($organization, $user, $weekStart);

        $entries = TimeEntry::query()
            ->where('user_id', $member->id)
            ->startingBetween($weekStart, $weekEnd)
            ->with(['project.client', 'tags'])
            ->orderBy('started_at')
            ->get();

        $periodStart = $view === 'day' ? $date : $weekStart;
        $periodEnd = $view === 'day' ? $date->addDay() : $weekEnd;
        $previousPeriodStart = $view === 'day' ? $date->subDay() : $weekStart->subWeek();
        $periodEntries = $view === 'day'
            ? $entries->filter(fn (TimeEntry $entry) => $entry->started_at->setTimezone($timezone)->isSameDay($date))
            : $entries;
        $previousPeriod = TimeEntry::query()
            ->where('user_id', $member->id)
            ->startingBetween($previousPeriodStart, $periodStart);

        // Absences in the week: the shown member's in full, colleagues' only as "off".
        $weekAbsences = Absence::query()
            ->forOrganization($organization)
            ->whereDate('starts_on', '<', $weekEnd->toDateString())
            ->whereDate('ends_on', '>=', $weekStart->toDateString())
            ->whereIn('user_id', $organization->members()->wherePivotNull('deactivated_at')->pluck('users.id'))
            ->with('user')
            ->orderBy('starts_on')
            ->get();

        $members = $this->memberOptions($organization, $user);

        return Inertia::render('time/index', [
            'view' => $view,
            'date' => $date->toDateString(),
            'today' => CarbonImmutable::now($timezone)->toDateString(),
            'weekStart' => $weekStart->toDateString(),
            'weekStartsOn' => $weekStartsOn ?? $organization->week_starts_on,
            'expectedWeekSeconds' => $view === 'week' ? fn () => WorkingDays::between(
                $weekStart,
                $weekEnd->subDay(),
                $absenceOptions['holidays'],
                $membership?->working_days ?? Membership::DEFAULT_WORKING_DAYS,
            ) * ($membership?->workday_seconds ?? $organization->workday_seconds) : null,
            'timezone' => $timezone,
            'entries' => $entries->map(fn (TimeEntry $entry) => $this->presenter->entry($entry, $timezone)),
            'absences' => $weekAbsences->where('user_id', $member->id)->values()->map(fn (Absence $absence) => AbsencePresenter::absence($absence)),
            'colleaguesOff' => $weekAbsences->where('user_id', '!=', $member->id)->values()->map(fn (Absence $absence) => AbsencePresenter::colleagueOff($absence)),
            ...$absenceOptions,
            'calendarHolidays' => fn () => $organization->holidays()
                ->whereDate('date', '>=', $periodStart->toDateString())
                ->whereDate('date', '<', $periodEnd->toDateString())
                ->orderBy('date')
                ->get(['date', 'name'])
                ->map(fn (Holiday $holiday) => ['date' => $holiday->date->toDateString(), 'name' => $holiday->name]),
            'projects' => $this->presenter->projectOptions($organization, $member),
            'tags' => $this->presenter->tagOptions($organization),
            'recentTags' => $this->presenter->recentTags($organization),
            'member' => ['id' => $member->id, 'name' => $member->name],
            // Owners and admins can switch to another member's time.
            'members' => $members,
            // So the entry form's project shortcuts follow the member it reports for.
            'recentProjects' => $this->presenter->recentProjectsByMember($organization, $members),
            'canCopyPreviousPeriod' => fn () => $periodEntries->isEmpty() && $previousPeriod->exists(),
            'previousPeriodEntries' => Inertia::optional(fn () => (clone $previousPeriod)
                ->with(['project.client', 'tags'])
                ->orderBy('started_at')
                ->get()
                ->map(fn (TimeEntry $entry) => $this->presenter->entry($entry, $timezone))),
        ]);
    }

    public function reportOptions(#[CurrentUser] User $user): JsonResponse
    {
        $organization = $this->currentOrganization->getOrFail();
        $today = CarbonImmutable::today($user->timezone);
        $members = $this->memberOptions($organization, $user);

        return response()->json([
            'today' => $today->toDateString(),
            'projects' => $this->presenter->projectOptions($organization, $user),
            'tags' => $this->presenter->tagOptions($organization),
            'recentTags' => $this->presenter->recentTags($organization),
            'members' => $members,
            'recentProjects' => $this->presenter->recentProjectsByMember($organization, $members),
            'absence' => $this->absenceOptions($organization, $user, $today),
        ]);
    }

    public function redirectLegacyIndex(Request $request): RedirectResponse
    {
        $query = $request->query();
        $isList = ($query['view'] ?? null) === 'list';

        if ($isList) {
            unset($query['view']);
        }

        // A form submitted from an older tab may redirect back here with validation errors.
        $request->session()->reflash();

        $path = route($isList ? 'time.list' : 'time.index', [
            'current_organization' => $this->currentOrganization->getOrFail()->slug,
        ]);

        return redirect()->to(URL::query($path, $query));
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

    public function copy(CopyTimeEntriesRequest $request, #[CurrentUser] User $user, CopyTimeEntries $copyTimeEntries): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();

        $sources = TimeEntry::query()->whereKey($request->entryIds())->with(['organization', 'tags'])->get();
        abort_if($sources->count() !== count($request->entryIds()), 404);

        foreach ($sources as $entry) {
            Gate::authorize('view', $entry);
            $this->authorizeMember($user, $organization, $entry->user_id);
        }

        $targetDay = $request->date('target_day', '!Y-m-d', $user->timezone)?->toImmutable();
        $created = $copyTimeEntries->handle($organization, $sources, $targetDay);

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

    /** @return array<int, array{value: string, label: string, avatar: string|null}> */
    private function memberOptions(Organization $organization, User $user): array
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime)
            ? $this->presenter->memberOptions($organization)
            : [];
    }

    /** @return array{absenceTypes: list<array{value: string, label: string}>, recentAbsenceTypes: list<string>, workdaySeconds: int, holidays: array<int, string>} */
    private function absenceOptions(Organization $organization, User $user, CarbonImmutable $date): array
    {
        return [
            'absenceTypes' => AbsenceType::options(),
            'recentAbsenceTypes' => AbsencePresenter::recentTypes($organization, $user),
            'workdaySeconds' => $organization->workday_seconds,
            // The absence dialog counts working days around the initial date.
            'holidays' => HolidayDates::between($organization->id, $date->subYear(), $date->addYear()),
        ];
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
