<?php

namespace App\Enums;

enum ContrastPreference: string
{
    /** Follow the device's "increase contrast" setting. */
    case System = 'system';

    case Normal = 'normal';

    /** Stronger borders and darker secondary text. */
    case More = 'more';
}
