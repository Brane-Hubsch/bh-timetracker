<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Working days in Sweden: Monday to Friday except public holidays, and the eves people normally
 * have off (midsummer, Christmas and New Year's Eve).
 */
final class WorkingDays
{
    /**
     * Working days from $from to $to, both included (0 when $to is before $from).
     */
    public static function between(CarbonImmutable $from, CarbonImmutable $to): int
    {
        $count = 0;
        $holidays = [];

        for ($day = $from->startOfDay(); $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $holidays[$day->year] ??= self::holidays($day->year);

            if (! $day->isWeekend() && ! isset($holidays[$day->year][$day->toDateString()])) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Holidays that can fall on a weekday, by date (Y-m-d).
     *
     * @return array<string, true>
     */
    private static function holidays(int $year): array
    {
        $easter = self::easterSunday($year);
        $midsummerEve = self::date($year, 6, 19);

        while (! $midsummerEve->isFriday()) {
            $midsummerEve = $midsummerEve->addDay();
        }

        $dates = [
            self::date($year, 1, 1),   // New Year's Day
            self::date($year, 1, 6),   // Epiphany
            $easter->subDays(2),                    // Good Friday
            $easter->addDay(),                      // Easter Monday
            self::date($year, 5, 1),   // May Day
            $easter->addDays(39),                   // Ascension Day
            self::date($year, 6, 6),   // National Day
            $midsummerEve,
            self::date($year, 12, 24), // Christmas Eve
            self::date($year, 12, 25), // Christmas Day
            self::date($year, 12, 26), // Boxing Day
            self::date($year, 12, 31), // New Year's Eve
        ];

        return array_fill_keys(array_map(fn (CarbonImmutable $date) => $date->toDateString(), $dates), true);
    }

    /**
     * Easter Sunday (Gregorian calendar, anonymous algorithm), without the calendar extension.
     */
    private static function easterSunday(int $year): CarbonImmutable
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $h = (19 * $a + $b - intdiv($b, 4) - intdiv($b - intdiv($b + 8, 25) + 1, 3) + 15) % 30;
        $l = (32 + 2 * ($b % 4) + 2 * intdiv($c, 4) - $h - $c % 4) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return self::date($year, $month, $day);
    }

    private static function date(int $year, int $month, int $day): CarbonImmutable
    {
        return CarbonImmutable::parse(sprintf('%04d-%02d-%02d', $year, $month, $day));
    }
}
