<?php

namespace App\Data;

/**
 * One time entry from a Clockify CSV export, with its times as local wall-clock strings
 * (`Y-m-d H:i:s`) in the time zone the export was made in.
 */
readonly class ClockifyRow
{
    /**
     * @param  array<int, string>  $tags
     */
    public function __construct(
        /** Line number in the file (the header is line 1). */
        public int $line,
        /** Lower-cased email of the Clockify user. */
        public string $email,
        public string $userName,
        public ?string $client,
        public ?string $project,
        public ?string $task,
        public ?string $description,
        public array $tags,
        public string $start,
        public string $end,
        /** From a "Billable" column when the export has one, else null. */
        public ?bool $billable,
    ) {
        //
    }

    /**
     * The description to store: the Clockify task first, then the description ("Utveckling – app").
     */
    public function combinedDescription(): ?string
    {
        $parts = array_filter([$this->task, $this->description], fn (?string $part) => $part !== null && $part !== '');

        return $parts === [] ? null : mb_substr(implode(' – ', $parts), 0, 5000);
    }
}
