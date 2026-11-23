<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Swedish public holidays that can fall on a weekday, plus the eves people normally have off
 * (midsummer, Christmas and New Year's Eve). Used to fill an organization's holidays.
 */
final class SwedishHolidays
{
    /**
     * @return array<string, string> Date (Y-m-d) => name, in date order
     */
    public static function for(int $year): array
    {
        $easter = self::easterSunday($year);
        $midsummerEve = self::date($year, 6, 19);

        while (! $midsummerEve->isFriday()) {
            $midsummerEve = $midsummerEve->addDay();
        }

        $holidays = [
            self::date($year, 1, 1)->toDateString() => __('New Year\'s Day'),
            self::date($year, 1, 6)->toDateString() => __('Epiphany'),
            $easter->subDays(2)->toDateString() => __('Good Friday'),
            $easter->addDay()->toDateString() => __('Easter Monday'),
            self::date($year, 5, 1)->toDateString() => __('May Day'),
            $easter->addDays(39)->toDateString() => __('Ascension Day'),
            self::date($year, 6, 6)->toDateString() => __('National Day of Sweden'),
            $midsummerEve->toDateString() => __('Midsummer Eve'),
            self::date($year, 12, 24)->toDateString() => __('Christmas Eve'),
            self::date($year, 12, 25)->toDateString() => __('Christmas Day'),
            self::date($year, 12, 26)->toDateString() => __('Boxing Day'),
            self::date($year, 12, 31)->toDateString() => __('New Year\'s Eve'),
        ];

        ksort($holidays);

        return $holidays;
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
