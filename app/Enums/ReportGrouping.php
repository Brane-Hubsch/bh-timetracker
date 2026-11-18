<?php

namespace App\Enums;

/**
 * Dimensions a report can be grouped by (two levels at most).
 */
enum ReportGrouping: string
{
    case Client = 'client';
    case Project = 'project';
    case Member = 'member';
    case Day = 'day';
    case Week = 'week';
    case Month = 'month';

    public function label(): string
    {
        return match ($this) {
            self::Client => __('Client'),
            self::Project => __('Project'),
            self::Member => __('Member'),
            self::Day => __('Day'),
            self::Week => __('Week'),
            self::Month => __('Month'),
        };
    }

    /**
     * Time buckets are ordered chronologically, everything else by time spent.
     */
    public function isTime(): bool
    {
        return in_array($this, [self::Day, self::Week, self::Month], true);
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $grouping) => ['value' => $grouping->value, 'label' => $grouping->label()], self::cases());
    }
}
