<?php

namespace App\Data;

/**
 * One project from Clockify's project export (Projects → Export).
 */
readonly class ClockifyProjectRow
{
    /**
     * @param  array<int, string>  $memberNames
     */
    public function __construct(
        /** Line number in the file (the header is line 1). */
        public int $line,
        public string $name,
        public ?string $client,
        public bool $archived,
        public bool $private,
        public ?int $estimateSeconds,
        public ?string $note,
        public array $memberNames,
    ) {
        //
    }
}
