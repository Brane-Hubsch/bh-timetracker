<?php

namespace App\Mcp\Tools;

use App\Actions\Tags\DeleteTag;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class DeleteTagTool extends TimetrackerTool
{
    protected string $name = 'delete_tag';

    protected string $description = 'Delete a tag (owners and admins only). It is removed from all time entries; the entries themselves stay. Destructive: confirm with the user first.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'tag' => $schema->string()->description('Tag id or name (see get_context).')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, DeleteTag $deleteTag): ResponseFactory
    {
        $request->validate(['tag' => ['required']]);

        $context = McpContext::from($request);
        $tag = $this->lookup->tag($context, $request->get('tag'));
        Gate::forUser($context->user)->authorize('delete', $tag);

        $entryCount = $tag->timeEntries()->count();
        $deleteTag->handle($tag);

        return Response::structured(['deleted' => ['name' => $tag->name, 'removed_from_entries' => $entryCount]]);
    }
}
