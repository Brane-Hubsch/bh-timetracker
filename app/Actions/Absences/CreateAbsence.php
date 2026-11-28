<?php

namespace App\Actions\Absences;

use App\Data\AbsenceData;
use App\Models\Absence;
use App\Models\Organization;
use Illuminate\Validation\ValidationException;

class CreateAbsence
{
    use ValidatesAbsences;

    /**
     * Register a member's absence (one or more days; weekends and holidays in it don't count).
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, AbsenceData $data): Absence
    {
        return $this->writeAbsence($organization, function () use ($organization, $data): Absence {
            $user = $this->validateAbsence($organization, $data);

            return Absence::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'type' => $data->type,
                'starts_on' => $data->startsOn->toDateString(),
                'ends_on' => $data->endsOn->toDateString(),
                'seconds_per_day' => $data->secondsPerDay,
                'note' => $this->normalizeNote($data->note),
            ]);
        });
    }

    private function normalizeNote(?string $note): ?string
    {
        $note = trim((string) $note);

        return $note === '' ? null : $note;
    }
}
