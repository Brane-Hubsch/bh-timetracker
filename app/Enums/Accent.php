<?php

namespace App\Enums;

/**
 * Accent colours for buttons, selections and links, contrast-checked against every theme (see app.css).
 */
enum Accent: string
{
    case Violet = 'violet';
    case Blue = 'blue';
    case Teal = 'teal';
    case Green = 'green';
    case Orange = 'orange';
    case Pink = 'pink';
    case Neutral = 'neutral';
}
