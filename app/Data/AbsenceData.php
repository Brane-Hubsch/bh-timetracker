<?php

namespace App\Data;

use App\Enums\AbsenceType;
use Carbon\CarbonImmutable;

/**
 * Input for creating or updating an absence. Dates are local days, both included.
 */
readonly class AbsenceData
{
    public function __construct(
        public int $userId,
        public AbsenceType $type,
        public CarbonImmutable $startsOn,
        public CarbonImmutable $endsOn,
        /** Null for full working days. */
        public ?int $secondsPerDay = null,
        public ?string $note = null,
    ) {
        //
    }
}
