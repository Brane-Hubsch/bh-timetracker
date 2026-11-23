<?php

namespace App\Actions\Absences;

use App\Data\AbsenceData;
use App\Models\Absence;
use Illuminate\Validation\ValidationException;

class UpdateAbsence
{
    use ValidatesAbsences;

    /**
     * Change an absence's kind, period, extent or note.
     *
     * @throws ValidationException
     */
    public function handle(Absence $absence, AbsenceData $data): Absence
    {
        $user = $this->validateAbsence($absence->organization, $data, $absence);
        $note = trim((string) $data->note);

        $absence->update([
            'user_id' => $user->id,
            'type' => $data->type,
            'starts_on' => $data->startsOn->toDateString(),
            'ends_on' => $data->endsOn->toDateString(),
            'seconds_per_day' => $data->secondsPerDay,
            'note' => $note === '' ? null : $note,
        ]);

        return $absence;
    }
}
