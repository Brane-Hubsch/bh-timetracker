<?php

namespace App\Mcp\Tools;

use App\Actions\Tags\RenameTag;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Tag;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class RenameTagTool extends TimetrackerTool
{
    protected string $name = 'rename_tag';

    protected string $description = 'Rename a tag (owners and admins only). Renaming to the name of another tag merges them: its time entries get the other tag and this tag is removed. Use it to merge duplicates such as "möte" and "Möten". Confirm a merge with the user first.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'tag' => $schema->string()->description('Tag id or name (see get_context).')->required(),
            'name' => $schema->string()->description('New name, at most '.Tag::MAX_NAME_LENGTH.' characters.')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, RenameTag $renameTag): ResponseFactory
    {
        $request->validate([
            'tag' => ['required'],
            'name' => ['required', 'string', 'max:'.Tag::MAX_NAME_LENGTH],
        ]);

        $context = McpContext::from($request);
        $tag = $this->lookup->tag($context, $request->get('tag'));
        Gate::forUser($context->user)->authorize('update', $tag);

        $previousName = $tag->name;
        $remaining = $renameTag->handle($tag, $this->stringArgument($request, 'name') ?? '');

        return Response::structured([
            $remaining->is($tag) ? 'renamed' : 'merged' => [
                'from' => $previousName,
                'to' => $remaining->name,
                'id' => $remaining->id,
            ],
        ]);
    }
}
