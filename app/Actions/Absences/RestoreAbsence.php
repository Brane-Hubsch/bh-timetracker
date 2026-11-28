<?php

namespace App\Actions\Absences;

use App\Data\AbsenceData;
use App\Models\Absence;

class RestoreAbsence
{
    use ValidatesAbsences;

    public function handle(Absence $absence): Absence
    {
        if (! $absence->trashed()) {
            return $absence;
        }

        return $this->writeAbsence($absence->organization, function () use ($absence): Absence {
            $current = Absence::query()
                ->forOrganization($absence->organization)
                ->withTrashed()
                ->where('user_id', $absence->user_id)
                ->lockForUpdate()
                ->findOrFail($absence->id);

            if ($current->trashed()) {
                $this->validateAbsence($absence->organization, new AbsenceData(
                    userId: $current->user_id,
                    type: $current->type,
                    startsOn: $current->starts_on->toImmutable(),
                    endsOn: $current->ends_on->toImmutable(),
                    secondsPerDay: $current->seconds_per_day,
                    note: $current->note,
                ), $current);

                $current->restore();
            }

            return $current;
        });
    }
}
