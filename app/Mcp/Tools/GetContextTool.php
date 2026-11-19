<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Mcp\Support\McpContext;
use App\Models\Organization;
use App\Models\Tag;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class GetContextTool extends TimetrackerTool
{
    /** ISO weekdays, 1 = Monday. */
    private const array WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    protected string $name = 'get_context';

    protected string $description = 'Who the user is, their organizations, the active organization, their permissions, time zone and the current local date and time. Call this first to interpret relative dates like "yesterday".';

    public function schema(JsonSchema $schema): array
    {
        return ['organization' => $this->organizationArgument($schema)];
    }

    public function handle(Request $request): ResponseFactory
    {
        $context = McpContext::from($request);
        $user = $context->user;
        $now = CarbonImmutable::now($context->timezone());

        return Response::structured([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'timezone' => $user->timezone],
            'now' => $now->format('Y-m-d H:i'),
            'today' => $now->toDateString(),
            'weekday' => $now->englishDayOfWeek,
            'organization' => [
                'slug' => $context->organization->slug,
                'name' => $context->organization->name,
                'currency' => $context->organization->currency,
                'week_starts_on' => self::WEEKDAYS[$context->organization->week_starts_on - 1] ?? 'Monday',
                'role' => $context->role?->value,
                'permissions' => [
                    'report_time_for_others' => $context->can(OrganizationPermission::ManageTeamTime),
                    'manage_clients' => $context->can(OrganizationPermission::ManageClients),
                    'manage_projects' => $context->can(OrganizationPermission::ManageProjects),
                    'see_rates_and_amounts' => $context->can(OrganizationPermission::ViewRates),
                ],
            ],
            // Existing tags, to reuse instead of creating near-duplicates.
            'tags' => Tag::query()->forOrganization($context->organization)->orderBy('name')->pluck('name')->all(),
            'organizations' => $user->organizations()->orderBy('name')->get()
                ->map(fn (Organization $organization) => ['slug' => $organization->slug, 'name' => $organization->name])
                ->values()
                ->all(),
        ]);
    }
}
