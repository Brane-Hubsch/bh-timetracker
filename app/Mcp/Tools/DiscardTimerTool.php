<?php

namespace App\Mcp\Tools;

use App\Actions\Timers\DiscardTimer;
use App\Mcp\Support\McpContext;
use App\Models\RunningTimer;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class DiscardTimerTool extends TimetrackerTool
{
    protected string $name = 'discard_timer';

    protected string $description = 'Throw the user\'s running timer away without saving any time. Destructive: confirm with the user first.';

    public function schema(JsonSchema $schema): array
    {
        return ['organization' => $this->organizationArgument($schema)];
    }

    public function handle(Request $request, DiscardTimer $discardTimer): ResponseFactory
    {
        $context = McpContext::from($request);
        $timer = RunningTimer::runningFor($context->user)
            ?? throw ValidationException::withMessages(['timer' => 'No timer is running.']);
        Gate::forUser($context->user)->authorize('delete', $timer);

        $summary = $this->timer($timer, $context);
        $discardTimer->handle($timer);

        return Response::structured(['discarded' => $summary]);
    }
}
