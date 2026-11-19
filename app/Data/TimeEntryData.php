<?php

namespace App\Data;

use App\Enums\TimeEntrySource;
use Carbon\CarbonImmutable;

/**
 * Input for creating or updating a time entry. Times may be in any time zone; they are stored as UTC.
 */
readonly class TimeEntryData
{
    public function __construct(
        public int $userId,
        public int $projectId,
        public CarbonImmutable $startedAt,
        public CarbonImmutable $endedAt,
        public ?string $description = null,
        /** Null means: inherit from the project (on create) or keep the current value (on update). */
        public ?bool $isBillable = null,
        public TimeEntrySource $source = TimeEntrySource::Web,
        /**
         * Tag names (created when missing). Null keeps the current tags on update and adds none on create.
         *
         * @var array<int, string>|null
         */
        public ?array $tags = null,
    ) {
        //
    }
}
