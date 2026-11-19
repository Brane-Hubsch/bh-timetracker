<?php

namespace App\Enums;

use Carbon\CarbonImmutable;

/**
 * Period presets for reports. Dates are local dates in the viewer's time zone; `to` is inclusive.
 */
enum ReportPeriod: string
{
    case ThisWeek = 'this_week';
    case LastWeek = 'last_week';
    case ThisMonth = 'this_month';
    case LastMonth = 'last_month';
    case ThisYear = 'this_year';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::ThisWeek => __('This week'),
            self::LastWeek => __('Last week'),
            self::ThisMonth => __('This month'),
            self::LastMonth => __('Last month'),
            self::ThisYear => __('This year'),
            self::Custom => __('Custom'),
        };
    }

    /**
     * @param  int  $weekStartsOn  ISO weekday (1 = Monday, 7 = Sunday)
     * @return array{0: CarbonImmutable, 1: CarbonImmutable} first and last day (inclusive)
     */
    public function range(CarbonImmutable $today, int $weekStartsOn, ?CarbonImmutable $from = null, ?CarbonImmutable $to = null): array
    {
        $today = $today->startOfDay();
        $weekStart = $today->startOfWeek($weekStartsOn % 7);

        return match ($this) {
            self::ThisWeek => [$weekStart, $weekStart->addDays(6)],
            self::LastWeek => [$weekStart->subWeek(), $weekStart->subDay()],
            self::ThisMonth => [$today->startOfMonth(), $today->endOfMonth()->startOfDay()],
            self::LastMonth => [$today->subMonthNoOverflow()->startOfMonth(), $today->subMonthNoOverflow()->endOfMonth()->startOfDay()],
            self::ThisYear => [$today->startOfYear(), $today->endOfYear()->startOfDay()],
            self::Custom => [($from ?? $today)->startOfDay(), ($to ?? $from ?? $today)->startOfDay()],
        };
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $period) => ['value' => $period->value, 'label' => $period->label()], self::cases());
    }
}
