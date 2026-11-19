<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\CreateClientTool;
use App\Mcp\Tools\CreateProjectTool;
use App\Mcp\Tools\CreateTimeEntriesTool;
use App\Mcp\Tools\DeleteTimeEntryTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\GetProjectStatusTool;
use App\Mcp\Tools\GetReportTool;
use App\Mcp\Tools\ListClientsTool;
use App\Mcp\Tools\ListProjectsTool;
use App\Mcp\Tools\ListTimeEntriesTool;
use App\Mcp\Tools\UpdateTimeEntryTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('BH Timetracker')]
#[Version('1.0.0')]
#[Instructions(<<<'TEXT'
BH Timetracker is the time tracking tool of the user's company. Time is reported on projects; projects
may belong to clients and have an estimate in hours. Every tool acts as the signed-in user with the same
permissions as in the web app: members see and change only their own time and never see rates or
amounts; owners and admins can see and report time for others and manage clients and projects.

- Call get_context first. It gives the user's time zone, today's date, weekday and organizations.
  Interpret relative dates ("yesterday", "last Thursday", "this afternoon") in that time zone. All times
  sent to and returned by the tools are local wall-clock times in that zone (YYYY-MM-DD, HH:MM).
- Most users belong to one organization. Pass `organization` (a slug) only to work in another one.
- Projects and clients can be given by id or by name ("Acme webbshop"). If a name is ambiguous the tool
  lists the candidates: ask the user which one is meant instead of guessing.
- Durations may be given as "1,5", "1.5", "1:30", "90m" or "1h 30m". "Afternoon" without a time means
  from 13:00. An entry is at most 24 hours; entries may cross midnight.
- Before creating several entries (e.g. "fill in my week"), updating or deleting, show the user what you
  are about to do and get a confirmation. Deleting cannot be undone through these tools.
- Answer in the user's language (often Swedish). Hours are decimals; amounts are in the organization's
  currency.
TEXT)]
class TimetrackerServer extends Server
{
    /**
     * @var array<int, class-string<Server\Tool>>
     */
    protected array $tools = [
        GetContextTool::class,
        ListClientsTool::class,
        CreateClientTool::class,
        ListProjectsTool::class,
        CreateProjectTool::class,
        ListTimeEntriesTool::class,
        CreateTimeEntriesTool::class,
        UpdateTimeEntryTool::class,
        DeleteTimeEntryTool::class,
        GetReportTool::class,
        GetProjectStatusTool::class,
    ];
}
