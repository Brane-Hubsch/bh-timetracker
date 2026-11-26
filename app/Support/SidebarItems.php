<?php

namespace App\Support;

final class SidebarItems
{
    public const LINKS = ['Calendar', 'List', 'Reports', 'Projects', 'Clients', 'Tags', 'Team'];

    public const ALL = ['Search', ...self::LINKS, 'Add'];
}
