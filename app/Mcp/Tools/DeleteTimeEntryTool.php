<?php

namespace App\Mcp\Tools;

use App\Actions\TimeEntries\DeleteTimeEntry;
use App\Mcp\Support\McpContext;
use App\Models\TimeEntry;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class DeleteTimeEntryTool extends TimetrackerTool
{
    protected string $name = 'delete_time_entry';

    protected string $description = 'Delete a time entry. Destructive: always confirm with the user first (show date, time, project and description). It cannot be restored through this tool.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()->description('Time entry id (from list_time_entries).')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, DeleteTimeEntry $deleteTimeEntry): ResponseFactory
    {
        $request->validate(['id' => ['required', 'integer']]);
        $context = McpContext::from($request);

        $entry = TimeEntry::query()->with(['project.client', 'user:id,name'])->find($id = $this->intArgument($request, 'id') ?? 0)
            ?? throw ValidationException::withMessages(['id' => "No time entry with id {$id} in this organization."]);
        Gate::forUser($context->user)->authorize('delete', $entry);

        $summary = $this->entry($entry, $context);
        $deleteTimeEntry->handle($entry);

        return Response::structured(['deleted' => $summary]);
    }
}
