<?php

namespace App\Support;

/**
 * Parses human durations into seconds. Accepted (case-insensitive, spaces ignored):
 *
 * - decimal hours: "1,5", "1.5", "2"
 * - hours and minutes: "1:30"
 * - with units: "90m", "90 min", "1h", "1h30", "1h 30m", "1 t 30 min" (t = timme)
 *
 * Mirrors resources/js/lib/duration.ts.
 */
class DurationParser
{
    public function parse(?string $input): ?int
    {
        $value = mb_strtolower(preg_replace('/\s+/u', '', (string) $input) ?? '');

        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d+):([0-5]?\d)$/', $value, $matches)) {
            return (int) $matches[1] * 3600 + (int) $matches[2] * 60;
        }

        if (preg_match('/^\d+(?:[.,]\d+)?$/', $value)) {
            return (int) round((float) str_replace(',', '.', $value) * 3600);
        }

        if (preg_match('/^(?:(\d+(?:[.,]\d+)?)(?:h|t|tim|timmar|timme))?(?:(\d+)(?:m|min|minuter)?)?$/', $value, $matches)
            && ($matches[1] ?? '').($matches[2] ?? '') !== '') {
            $hours = (float) str_replace(',', '.', $matches[1] ?? '0');
            $minutes = (int) ($matches[2] ?? 0);

            return (int) round($hours * 3600 + $minutes * 60);
        }

        return null;
    }
}
