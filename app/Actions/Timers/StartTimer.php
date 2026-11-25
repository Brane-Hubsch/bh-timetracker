<?php

namespace App\Actions\Timers;

use App\Data\TimerData;
use App\Enums\TimeEntrySource;
use App\Models\Organization;
use App\Models\RunningTimer;
use App\Models\Scopes\OrganizationScope;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StartTimer
{
    use ValidatesTimers;

    public function __construct(private readonly StopTimer $stopTimer)
    {
        //
    }

    /**
     * Start the person's timer in the organization. A timer that is already running (in any
     * organization) is stopped and saved first, ending when the new one starts, like switching task.
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, User $user, TimerData $data, TimeEntrySource $source = TimeEntrySource::Web): RunningTimer
    {
        if (! $organization->timer_enabled) {
            throw ValidationException::withMessages(['timer' => __('The timer is turned off in this organization.')]);
        }

        $this->validateTimer($organization, $user, $data);

        return DB::transaction(function () use ($organization, $user, $data, $source) {
            $running = RunningTimer::query()->withoutGlobalScope(OrganizationScope::class)->with('organization')
                ->where('user_id', $user->id)->lockForUpdate()->first();

            if ($running !== null) {
                if ($running->project_id === null) {
                    throw ValidationException::withMessages(['timer' => __('Your running timer has no project. Stop or discard it first.')]);
                }

                $now = CarbonImmutable::now();
                $switchAt = $data->startedAt->greaterThan($running->started_at) && $data->startedAt->lessThan($now) ? $data->startedAt : $now;
                $this->stopTimer->handle($running, $switchAt, $source);
            }

            return RunningTimer::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'project_id' => $data->projectId,
                'description' => $this->description($data->description),
                'is_billable' => $data->isBillable,
                'tags' => $this->tagNames($data->tags),
                'started_at' => $data->startedAt->utc(),
            ]);
        });
    }

    private function description(?string $description): ?string
    {
        $description = trim((string) $description);

        return $description === '' ? null : $description;
    }
}
