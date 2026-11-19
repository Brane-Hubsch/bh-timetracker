<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A sign-in attempt that is valid on its own but not allowed here (e.g. no account and no invitation).
 * The message is user-facing and translated.
 */
class SignInNotAllowedException extends RuntimeException
{
    //
}
