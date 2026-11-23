<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\ArchiveClientTool;
use App\Mcp\Tools\ArchiveProjectTool;
use App\Mcp\Tools\CancelInvitationTool;
use App\Mcp\Tools\CreateAbsenceTool;
use App\Mcp\Tools\CreateClientTool;
use App\Mcp\Tools\CreateProjectTool;
use App\Mcp\Tools\CreateTimeEntriesTool;
use App\Mcp\Tools\DeleteAbsenceTool;
use App\Mcp\Tools\DeleteTagTool;
use App\Mcp\Tools\DeleteTimeEntryTool;
use App\Mcp\Tools\ExportReportTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\GetProjectStatusTool;
use App\Mcp\Tools\GetReportTool;
use App\Mcp\Tools\InviteMemberTool;
use App\Mcp\Tools\ListAbsencesTool;
use App\Mcp\Tools\ListClientsTool;
use App\Mcp\Tools\ListMembersTool;
use App\Mcp\Tools\ListProjectsTool;
use App\Mcp\Tools\ListTimeEntriesTool;
use App\Mcp\Tools\RemoveMemberTool;
use App\Mcp\Tools\RenameTagTool;
use App\Mcp\Tools\UpdateAbsenceTool;
use App\Mcp\Tools\UpdateClientTool;
use App\Mcp\Tools\UpdateMemberTool;
use App\Mcp\Tools\UpdateProjectTool;
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
- Owners and admins can also manage members and invitations, rename/merge/delete tags and change or
  archive clients and projects. Archiving can be undone (archived=false); removing a member, cancelling
  an invitation and deleting a tag cannot, so confirm those first.
- Absence (vacation, care of a sick child "VAB", sick leave, parental leave, leave of absence) is kept
  apart from time entries: register it with create_absence, never as time on a project. Full days count
  as the organization's working day (get_context); weekends and holidays don't count.
- export_report gives a download link to a PDF, Excel or CSV file for the user to open in their browser;
  use get_report when you need the numbers yourself.
- Answer in the user's language (often Swedish). Hours are decimals; amounts are in the organization's
  currency.
TEXT)]
class TimetrackerServer extends Server
{
    /** List every tool on one page; some clients don't follow the pagination cursor. */
    public int $defaultPaginationLength = 50;

    /**
     * @var array<int, class-string<Server\Tool>>
     */
    protected array $tools = [
        GetContextTool::class,
        ListClientsTool::class,
        CreateClientTool::class,
        UpdateClientTool::class,
        ArchiveClientTool::class,
        ListProjectsTool::class,
        CreateProjectTool::class,
        UpdateProjectTool::class,
        ArchiveProjectTool::class,
        ListTimeEntriesTool::class,
        CreateTimeEntriesTool::class,
        UpdateTimeEntryTool::class,
        DeleteTimeEntryTool::class,
        GetReportTool::class,
        ExportReportTool::class,
        GetProjectStatusTool::class,
        RenameTagTool::class,
        DeleteTagTool::class,
        ListMembersTool::class,
        InviteMemberTool::class,
        CancelInvitationTool::class,
        UpdateMemberTool::class,
        RemoveMemberTool::class,
        ListAbsencesTool::class,
        CreateAbsenceTool::class,
        UpdateAbsenceTool::class,
        DeleteAbsenceTool::class,
    ];
}
