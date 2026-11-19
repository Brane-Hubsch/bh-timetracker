<?php

namespace App\Enums;

/**
 * The kinds of uploaded images and how they are processed.
 */
enum ImageKind: string
{
    /** Profile pictures: cropped to a square around the centre. */
    case Avatar = 'avatars';

    /** Organization and client logos: scaled to fit, never cropped or enlarged, transparency kept. */
    case Logo = 'logos';

    public function crops(): bool
    {
        return $this === self::Avatar;
    }
}
