<?php

namespace App\Enums;

/**
 * Kinds of absence. Colleagues only ever see "off" (ledig); the kind is for the person themselves
 * and for those who manage the team's time.
 */
enum AbsenceType: string
{
    case Vacation = 'vacation';
    case ChildCare = 'child_care';
    case Sick = 'sick';
    case ParentalLeave = 'parental_leave';
    case LeaveOfAbsence = 'leave_of_absence';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Vacation => __('Vacation'),
            self::ChildCare => __('Care of sick child'),
            self::Sick => __('Sick'),
            self::ParentalLeave => __('Parental leave'),
            self::LeaveOfAbsence => __('Leave of absence'),
            self::Other => __('Other absence'),
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $type) => ['value' => $type->value, 'label' => $type->label()], self::cases());
    }
}
