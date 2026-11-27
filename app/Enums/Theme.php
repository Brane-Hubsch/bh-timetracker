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

    /** Green on black with a monospace font, always dark. Has its own accent colour. */
    case Terminal = 'terminal';

    /** Pink everything, for fun. Has its own accent colour. */
    case Barbie = 'barbie';

    /**
     * Whether the theme ignores the light/dark setting and is always dark.
     */
    public function isAlwaysDark(): bool
    {
        return $this === self::Terminal;
    }
}
