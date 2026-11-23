<?php

namespace App\Actions\Absences;

use App\Models\Absence;

class DeleteAbsence
{
    public function handle(Absence $absence): void
    {
        $absence->delete();
    }
}
