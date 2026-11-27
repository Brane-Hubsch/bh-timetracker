<?php

namespace App\Enums;

/**
 * Colour themes for backgrounds and surfaces. Each has a light and a dark variant (see app.css).
 */
enum Theme: string
{
    /** The original look: neutral greys with a slight violet tint. */
    case Standard = 'standard';

    /** Warm, soft sand tones and rounder corners. */
    case Sand = 'sand';

    /** Cool blue-grey tones. */
    case Slate = 'slate';

    /** Pure neutral greys and tighter corners. */
    case Graphite = 'graphite';
}
