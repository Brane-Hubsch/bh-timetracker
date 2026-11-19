<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationPermission;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\CurrentOrganization;
use App\Support\TimeEntryPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * "Today": my time today and this week, recent entries and quick entry. Owners and admins also
     * see the team's hours this week and projects close to their estimate.
     */
    public function __invoke(#[CurrentUser] User $user, CurrentOrganization $currentOrganization, TimeEntryPresenter $presenter): Response
    {
        $organization = $currentOrganization->getOrFail();
        $timezone = $user->timezone;
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $weekStart = $presenter->weekStart($today, $organization);
        $isManager = $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime);
        $members = $isManager ? $presenter->memberOptions($organization) : [];

        $myWeek = TimeEntry::query()
            ->where('user_id', $user->id)
            ->startingBetween($weekStart, $weekStart->addWeek());

        return Inertia::render('dashboard', [
            'pendingInvitations' => OrganizationInvitation::query()
                ->pendingFor($user->email)
                ->with(['inviter', 'organization'])
                ->latest()
                ->get()
                ->map(fn (OrganizationInvitation $invitation) => $invitation->toPendingInvitationData()),
            'today' => $today->toDateString(),
            'weekStartsOn' => $organization->week_starts_on,
            'todaySeconds' => (int) (clone $myWeek)->startingBetween($today, $today->addDay())->sum('duration_seconds'),
            'weekSeconds' => (int) (clone $myWeek)->sum('duration_seconds'),
            'recentEntries' => TimeEntry::query()
                ->where('user_id', $user->id)
                ->with(['project.client', 'tags'])
                ->latest('started_at')
                ->limit(5)
                ->get()
                ->map(fn (TimeEntry $entry) => $presenter->entry($entry, $timezone)),
            'projects' => $presenter->projectOptions($organization, $user),
            'tags' => $presenter->tagOptions($organization),
            // Owners and admins can report time for other members from the quick entry form.
            'members' => $members,
            'recentProjects' => $presenter->recentProjectsByMember($organization, $members),
            'team' => $isManager ? $this->teamWeek($organization->members()->wherePivotNull('deactivated_at')->orderBy('name')->get(), $weekStart) : null,
            'projectsNearEstimate' => $isManager ? $this->projectsNearEstimate() : null,
        ]);
    }

    /**
     * @param  iterable<User>  $members
     * @return list<array{id: int, name: string, seconds: int}>
     */
    private function teamWeek(iterable $members, CarbonImmutable $weekStart): array
    {
        $totals = TimeEntry::query()
            ->startingBetween($weekStart, $weekStart->addWeek())
            ->selectRaw('user_id, SUM(duration_seconds) as seconds')
            ->groupBy('user_id')
            ->pluck('seconds', 'user_id');

        $team = [];

        foreach ($members as $member) {
            $seconds = $totals->get($member->id);
            $team[] = ['id' => $member->id, 'name' => $member->name, 'seconds' => is_numeric($seconds) ? (int) $seconds : 0];
        }

        return $team;
    }

    /**
     * Active projects with an estimate that have used at least 80 % of it.
     *
     * @return list<array{id: int, name: string, color: string, consumedSeconds: int, estimateSeconds: int}>
     */
    private function projectsNearEstimate(): array
    {
        $projects = Project::query()
            ->active()
            ->whereNotNull('estimate_seconds')
            ->withSum('timeEntries as consumed_seconds', 'duration_seconds')
            ->get();

        $near = [];

        foreach ($projects as $project) {
            $consumed = is_numeric($project->getAttribute('consumed_seconds')) ? (int) $project->getAttribute('consumed_seconds') : 0;

            if ($project->estimate_seconds !== null && $consumed >= $project->estimate_seconds * 0.8) {
                $near[] = [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color,
                    'consumedSeconds' => $consumed,
                    'estimateSeconds' => $project->estimate_seconds,
                ];
            }
        }

        usort($near, fn (array $a, array $b) => $b['consumedSeconds'] / $b['estimateSeconds'] <=> $a['consumedSeconds'] / $a['estimateSeconds']);

        return $near;
    }
}
