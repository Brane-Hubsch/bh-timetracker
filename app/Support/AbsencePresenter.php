<?php

namespace App\Support;

use App\Models\Absence;

/**
 * Absences as the frontend gets them. Colleagues only get "off" with the person's name, never the
 * kind or note.
 */
final class AbsencePresenter
{
    /**
     * @return array{id: int, userId: int, type: string, label: string, startsOn: string, endsOn: string, secondsPerDay: int|null, note: string|null}
     */
    public static function absence(Absence $absence): array
    {
        return [
            'id' => $absence->id,
            'userId' => $absence->user_id,
            'type' => $absence->type->value,
            'label' => $absence->type->label(),
            'startsOn' => $absence->starts_on->toDateString(),
            'endsOn' => $absence->ends_on->toDateString(),
            'secondsPerDay' => $absence->seconds_per_day,
            'note' => $absence->note,
        ];
    }

    /**
     * @return array{id: int, name: string, startsOn: string, endsOn: string}
     */
    public static function colleagueOff(Absence $absence): array
    {
        return [
            'id' => $absence->id,
            'name' => $absence->user->name,
            'startsOn' => $absence->starts_on->toDateString(),
            'endsOn' => $absence->ends_on->toDateString(),
        ];
    }
}
