<?php

namespace App\Exceptions;

use RuntimeException;

class MissingCurrentOrganizationException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('No active organization. Tenant data must be accessed within an organization context.');
    }
}
