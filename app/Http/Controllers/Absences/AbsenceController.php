<?php

namespace App\Http\Controllers\Absences;

use App\Actions\Absences\CreateAbsence;
use App\Actions\Absences\DeleteAbsence;
use App\Actions\Absences\RestoreAbsence;
use App\Actions\Absences\UpdateAbsence;
use App\Http\Controllers\Controller;
use App\Http\Requests\Absences\AbsenceRequest;
use App\Models\Absence;
use App\Models\User;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Absence (vacation, care of sick child, ...) from the calendar. Members register their own;
 * owners and admins also other members'.
 */
class AbsenceController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function store(AbsenceRequest $request, #[CurrentUser] User $user, CreateAbsence $createAbsence): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();
        $data = $request->absenceData($user);
        $this->authorizeMember($user, $data->userId);

        $createAbsence->handle($organization, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Absence saved.')]);

        return back();
    }

    public function update(AbsenceRequest $request, #[CurrentUser] User $user, Absence $absence, UpdateAbsence $updateAbsence): RedirectResponse
    {
        Gate::authorize('update', $absence);

        $data = $request->absenceData($absence->user);
        $this->authorizeMember($user, $data->userId);

        $updateAbsence->handle($absence, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Absence saved.')]);

        return back();
    }

    public function destroy(Absence $absence, DeleteAbsence $deleteAbsence): RedirectResponse
    {
        Gate::authorize('delete', $absence);

        $deleteAbsence->handle($absence);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Absence deleted.'),
            'undo' => route('absences.restore', ['absence' => $absence->id]),
        ]);

        return back();
    }

    public function restore(Absence $absence, RestoreAbsence $restoreAbsence): RedirectResponse
    {
        Gate::authorize('restore', $absence);

        try {
            $restoreAbsence->handle($absence);
        } catch (ValidationException $exception) {
            Inertia::flash('toast', ['type' => 'warning', 'message' => $exception->getMessage()]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Absence restored.')]);

        return back();
    }

    private function authorizeMember(User $user, int $memberId): void
    {
        $member = User::find($memberId);

        abort_unless($member && Gate::forUser($user)->allows('manageFor', [Absence::class, $this->currentOrganization->getOrFail(), $member]), 403);
    }
}
