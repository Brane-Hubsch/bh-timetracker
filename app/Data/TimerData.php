<?php

namespace App\Data;

use Carbon\CarbonImmutable;

/**
 * What a running timer is for: project (may be chosen later), description, billable, tag names and
 * when it started.
 */
readonly class TimerData
{
    /**
     * @param  array<int, string>  $tags
     */
    public function __construct(
        public ?int $projectId,
        public CarbonImmutable $startedAt,
        public ?string $description = null,
        /** Null follows the project. */
        public ?bool $isBillable = null,
        public array $tags = [],
    ) {
        //
    }
}
