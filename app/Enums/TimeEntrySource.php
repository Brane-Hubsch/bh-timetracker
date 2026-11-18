<?php

namespace App\Enums;

enum TimeEntrySource: string
{
    case Web = 'web';
    case Mcp = 'mcp';
    case Import = 'import';
}
