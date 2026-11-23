<?php

namespace App\Mcp\Tools;

use App\Actions\Absences\DeleteAbsence;
use App\Mcp\Support\McpContext;
use App\Models\Absence;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class DeleteAbsenceTool extends TimetrackerTool
{
    protected string $name = 'delete_absence';

    protected string $description = 'Delete an absence. Destructive: always confirm with the user first (show the member, type and dates). It cannot be restored.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()->description('Absence id (from list_absences).')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, DeleteAbsence $deleteAbsence): ResponseFactory
    {
        $request->validate(['id' => ['required', 'integer']]);
        $context = McpContext::from($request);
        $absence = Absence::query()->with('user:id,name')->find($id = $this->intArgument($request, 'id') ?? 0)
            ?? throw ValidationException::withMessages(['id' => "No absence with id {$id} in this organization."]);
        Gate::forUser($context->user)->authorize('delete', $absence);

        $summary = $this->absence($absence, $context);
        $deleteAbsence->handle($absence);

        return Response::structured(['deleted' => $summary]);
    }
}
