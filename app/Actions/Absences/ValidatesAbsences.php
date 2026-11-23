<?php

namespace App\Actions\Absences;

use App\Data\AbsenceData;
use App\Models\Absence;
use App\Models\Organization;
use App\Models\User;
use App\Support\AbsenceTime;
use App\Support\HolidayDates;
use Illuminate\Validation\ValidationException;

/**
 * Business rules shared by creating and updating absences.
 */
trait ValidatesAbsences
{
    /**
     * @throws ValidationException
     */
    protected function validateAbsence(Organization $organization, AbsenceData $data, ?Absence $existing = null): User
    {
        $user = User::find($data->userId);
        $userChanged = $existing === null || $existing->user_id !== $data->userId;

        if (! $user || ($userChanged && ! $user->belongsToOrganization($organization))) {
            throw ValidationException::withMessages(['user_id' => __('The user is not a member of the organization.')]);
        }

        if ($data->endsOn->lessThan($data->startsOn)) {
            throw ValidationException::withMessages(['ends_on' => __('The end date must be on or after the start date.')]);
        }

        if ($data->startsOn->diffInDays($data->endsOn) + 1 > Absence::MAX_DAYS) {
            throw ValidationException::withMessages(['ends_on' => __('An absence can be at most :days days.', ['days' => Absence::MAX_DAYS])]);
        }

        if ($data->secondsPerDay !== null && ($data->secondsPerDay <= 0 || $data->secondsPerDay > 86400)) {
            throw ValidationException::withMessages(['hours_per_day' => __('Enter the hours per day, at most 24.')]);
        }

        if ($data->note !== null && mb_strlen($data->note) > Absence::MAX_NOTE_LENGTH) {
            throw ValidationException::withMessages(['note' => __('The note can be at most :max characters.', ['max' => Absence::MAX_NOTE_LENGTH])]);
        }

        $time = AbsenceTime::for($data->startsOn, $data->endsOn, $data->secondsPerDay, $organization->workday_seconds, HolidayDates::between($organization->id, $data->startsOn, $data->endsOn));

        if ($time['days'] === 0) {
            throw ValidationException::withMessages(['starts_on' => __('The period has no working days.')]);
        }

        $overlaps = Absence::query()
            ->forOrganization($organization)
            ->where('user_id', $user->id)
            ->when($existing !== null, fn ($query) => $query->whereKeyNot($existing?->id))
            ->whereDate('starts_on', '<=', $data->endsOn->toDateString())
            ->whereDate('ends_on', '>=', $data->startsOn->toDateString())
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['starts_on' => __(':name already has an absence in this period.', ['name' => $user->name])]);
        }

        return $user;
    }
}
