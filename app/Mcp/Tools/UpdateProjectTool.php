<?php

namespace App\Mcp\Tools;

use App\Actions\Projects\SaveProject;
use App\Enums\OrganizationPermission;
use App\Enums\ProjectVisibility;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class UpdateProjectTool extends TimetrackerTool
{
    /** Arguments that change something, besides the project reference. */
    private const array FIELDS = ['name', 'client', 'code', 'billable', 'hourly_rate', 'estimate_hours', 'private', 'starts_on', 'ends_on', 'notes'];

    protected string $name = 'update_project';

    protected string $description = 'Change a project (owners and admins only). Only the given fields change; send null to clear an optional field (client, code, hourly_rate, estimate_hours, starts_on, ends_on, notes).';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'project' => $schema->string()->description('Project id or name (see list_projects).')->required(),
            'name' => $schema->string()->description('New name.'),
            'client' => $schema->string()->description('Client id or name; null makes it an internal project.'),
            'code' => $schema->string()->description('Short unique code, e.g. "ACME-02".'),
            'billable' => $schema->boolean()->description('Whether new time is billable by default.'),
            'hourly_rate' => $schema->number()->description('Hourly rate in the organization currency (e.g. 1100); null uses member/organization rates.'),
            'estimate_hours' => $schema->number()->description('Estimated hours.'),
            'private' => $schema->boolean()->description('Only assigned members can see it.'),
            'starts_on' => $schema->string()->description('Start date, YYYY-MM-DD.'),
            'ends_on' => $schema->string()->description('End date, YYYY-MM-DD.'),
            'notes' => $schema->string()->description('Notes shown on the project page to everyone on the project.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, SaveProject $saveProject): ResponseFactory
    {
        $context = McpContext::from($request);

        $request->validate([
            'project' => ['required'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'billable' => ['nullable', 'boolean'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'estimate_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'private' => ['nullable', 'boolean'],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $project = $this->lookup->project($context, $request->get('project'));
        Gate::forUser($context->user)->authorize('update', $project);

        if (! array_any(self::FIELDS, fn (string $field) => $this->provided($request, $field))) {
            throw ValidationException::withMessages(['project' => 'Give at least one field to change.']);
        }

        $request->validate([
            'code' => ['nullable', 'string', 'max:32', Rule::unique('projects', 'code')->where('organization_id', $context->organization->id)->ignore($project->id)],
        ]);

        $clientId = $project->client_id;

        if ($this->provided($request, 'client')) {
            $clientReference = $this->stringArgument($request, 'client');
            $clientId = $clientReference === null ? null : $this->lookup->client($context, $clientReference)->id;
        }

        $hourlyRate = $request->get('hourly_rate');
        $estimateHours = $request->get('estimate_hours');
        $startsOn = $this->provided($request, 'starts_on') ? $this->stringArgument($request, 'starts_on') : $project->starts_on?->toDateString();
        $endsOn = $this->provided($request, 'ends_on') ? $this->stringArgument($request, 'ends_on') : $project->ends_on?->toDateString();

        if ($startsOn !== null && $endsOn !== null && $endsOn < $startsOn) {
            throw ValidationException::withMessages(['ends_on' => 'The end date must be on or after the start date ('.$startsOn.').']);
        }

        $private = $this->provided($request, 'private')
            ? (bool) $this->boolArgument($request, 'private')
            : $project->visibility === ProjectVisibility::Private;

        $project = $saveProject->handle($context->organization, [
            'name' => $this->provided($request, 'name') ? ($this->stringArgument($request, 'name') ?? $project->name) : $project->name,
            'client_id' => $clientId,
            'code' => $this->provided($request, 'code') ? $this->stringArgument($request, 'code') : $project->code,
            'color' => $project->color,
            'is_billable' => $this->provided($request, 'billable') ? (bool) $this->boolArgument($request, 'billable') : $project->is_billable,
            'hourly_rate' => $this->provided($request, 'hourly_rate')
                ? (is_numeric($hourlyRate) ? (int) round((float) $hourlyRate * 100) : null)
                : $project->hourly_rate,
            'estimate_seconds' => $this->provided($request, 'estimate_hours')
                ? (is_numeric($estimateHours) ? (int) round((float) $estimateHours * 3600) : null)
                : $project->estimate_seconds,
            'visibility' => $private ? ProjectVisibility::Private->value : ProjectVisibility::Public->value,
            'starts_on' => $startsOn,
            'ends_on' => $endsOn,
            'notes' => $this->provided($request, 'notes') ? $this->stringArgument($request, 'notes') : $project->notes,
        ], $project);

        $project->load('client');
        $showRates = $context->can(OrganizationPermission::ViewRates);

        return Response::structured(['updated' => array_filter([
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client?->name,
            'code' => $project->code,
            'billable' => $project->is_billable,
            'hourly_rate' => $showRates ? $this->money($project->hourly_rate) : null,
            'estimate_hours' => $project->estimate_seconds === null ? null : $this->hours($project->estimate_seconds),
            'private' => $project->visibility === ProjectVisibility::Private,
            'starts_on' => $project->starts_on?->toDateString(),
            'ends_on' => $project->ends_on?->toDateString(),
            'notes' => $project->notes,
            'archived' => $project->archived_at !== null,
        ], fn (mixed $value) => $value !== null)]);
    }
}
