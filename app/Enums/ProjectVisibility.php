<?php

namespace App\Enums;

enum ProjectVisibility: string
{
    /** Every member of the organization can report time on the project. */
    case Public = 'public';

    /** Only members assigned to the project can see it and report time on it. */
    case Private = 'private';

    /**
     * Get the display label.
     */
    public function label(): string
    {
        return __(ucfirst($this->value));
    }
}
