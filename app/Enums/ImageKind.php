<?php

namespace App\Enums;

/**
 * The kinds of uploaded images and how they are processed.
 */
enum ImageKind
{
    /** Profile pictures: cropped to a square around the centre. */
    case Avatar;

    /** Workspace icons: cropped to a square around the centre. */
    case OrganizationLogo;

    /** Client logos: scaled to fit while preserving their original proportions. */
    case Logo;

    public function directory(): string
    {
        return $this === self::Avatar ? 'avatars' : 'logos';
    }

    public function crops(): bool
    {
        return $this !== self::Logo;
    }
}
