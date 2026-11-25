<?php

namespace App\Http\Controllers\Timers;

use App\Actions\Timers\DiscardTimer;
use App\Actions\Timers\StartTimer;
use App\Actions\Timers\StopTimer;
use App\Actions\Timers\UpdateTimer;
use App\Http\Controllers\Controller;
use App\Http\Requests\Timers\StopTimerRequest;
use App\Http\Requests\Timers\TimerRequest;
use App\Models\RunningTimer;
use App\Models\User;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * The signed-in person's timer. It is started in the current organization; the running timer is
 * theirs wherever it runs, so updating, stopping and discarding work from any organization.
 */
class TimerController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function store(TimerRequest $request, #[CurrentUser] User $user, StartTimer $startTimer): RedirectResponse
    {
        $startTimer->handle($this->currentOrganization->getOrFail(), $user, $request->timerData());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Timer started.')]);

        return back();
    }

    public function update(TimerRequest $request, #[CurrentUser] User $user, UpdateTimer $updateTimer): RedirectResponse
    {
        $timer = $this->timer($user, 'update');
        $updateTimer->handle($timer, $request->timerData());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Timer saved.')]);

        return back();
    }

    public function stop(StopTimerRequest $request, #[CurrentUser] User $user, UpdateTimer $updateTimer, StopTimer $stopTimer): RedirectResponse
    {
        $timer = $this->timer($user, 'update');

        // Saving the details and stopping succeed or fail together.
        DB::transaction(function () use ($request, $timer, $updateTimer, $stopTimer) {
            if ($request->hasDetails()) {
                $updateTimer->handle($timer, $request->timerData());
            }

            $stopTimer->handle($timer, $request->endedAt());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Timer stopped and the time saved.')]);

        return back();
    }

    public function destroy(#[CurrentUser] User $user, DiscardTimer $discardTimer): RedirectResponse
    {
        $discardTimer->handle($this->timer($user, 'delete'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Timer discarded.')]);

        return back();
    }

    private function timer(User $user, string $ability): RunningTimer
    {
        $timer = RunningTimer::runningFor($user);
        abort_if($timer === null, 404);
        Gate::authorize($ability, $timer);

        return $timer;
    }
}
