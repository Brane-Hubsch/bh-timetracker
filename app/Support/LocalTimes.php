<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Times are entered as a local date, a start time and either an end time or a duration, in the
 * user's time zone. An end at or before the start means the next day. Used by the web form and the
 * MCP tools so both interpret input the same way.
 */
final class LocalTimes
{
    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable} start and end in UTC
     */
    public static function toUtc(string $date, string $start, ?string $end, ?int $durationSeconds, string $timezone): array
    {
        $startedAt = CarbonImmutable::parse($date.' '.$start, $timezone);

        if ($end !== null && $end !== '') {
            $endedAt = CarbonImmutable::parse($date.' '.$end, $timezone);

            if ($endedAt->lessThanOrEqualTo($startedAt)) {
                $endedAt = $endedAt->addDay();
            }
        } else {
            $endedAt = $startedAt->addSeconds($durationSeconds ?? 0);
        }

        return [$startedAt->utc(), $endedAt->utc()];
    }
}
