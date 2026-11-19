<?php

use App\Actions\Projects\AssignProjectMember;
use App\Actions\Projects\SaveProject;
use App\Actions\Projects\SetProjectArchived;
use App\Actions\Projects\UnassignProjectMember;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use Illuminate\Validation\ValidationException;

function projectAttributes(array $overrides = []): array
{
    return [
        'name' => 'Webbshop',
        'client_id' => null,
        'code' => 'WEB',
        'color' => '#7c3aed',
        'is_billable' => true,
        'hourly_rate' => 110000,
        'estimate_seconds' => 120 * 3600,
        'visibility' => 'public',
        'starts_on' => '2026-11-01',
        'ends_on' => null,
        ...$overrides,
    ];
}

it('creates a project', function () {
    $owner = User::factory()->create();
    $client = Client::factory()->for($owner->currentOrganization)->create();

    $project = app(SaveProject::class)->handle($owner->currentOrganization, projectAttributes(['client_id' => $client->id]));

    expect($project->organization_id)->toBe($owner->current_organization_id)
        ->and($project->client->is($client))->toBeTrue()
        ->and($project->hourly_rate)->toBe(110000)
        ->and($project->estimate_seconds)->toBe(432000)
        ->and($project->visibility)->toBe(ProjectVisibility::Public)
        ->and($project->starts_on->toDateString())->toBe('2026-11-01');
});

it('updates a project', function () {
    $owner = User::factory()->create();
    $project = Project::factory()->for($owner->currentOrganization)->create();

    app(SaveProject::class)->handle($owner->currentOrganization, projectAttributes(['name' => 'Renamed', 'visibility' => 'private']), $project);

    expect($project->fresh()->name)->toBe('Renamed')
        ->and($project->fresh()->visibility)->toBe(ProjectVisibility::Private);
});

it('refuses a client from another organization', function () {
    $owner = User::factory()->create();
    $foreignClient = Client::factory()->create();

    app(SaveProject::class)->handle($owner->currentOrganization, projectAttributes(['client_id' => $foreignClient->id]));
})->throws(ValidationException::class);

it('archives and restores a project', function () {
    $project = Project::factory()->create();

    app(SetProjectArchived::class)->handle($project, true);
    expect($project->fresh()->isArchived())->toBeTrue();

    app(SetProjectArchived::class)->handle($project, false);
    expect($project->fresh()->isArchived())->toBeFalse();
});

it('assigns members with an optional rate and updates the rate', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $owner->currentOrganization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $project = Project::factory()->for($owner->currentOrganization)->create();

    app(AssignProjectMember::class)->handle($project, $member, 95000);
    expect($project->members()->first()->assignment->hourly_rate)->toBe(95000);

    app(AssignProjectMember::class)->handle($project, $member, null);
    expect($project->members()->count())->toBe(1)
        ->and($project->members()->first()->assignment->hourly_rate)->toBeNull();

    app(UnassignProjectMember::class)->handle($project, $member);
    expect($project->members()->count())->toBe(0);
});

it('only assigns active members of the project\'s organization', function (string $case) {
    $owner = User::factory()->create();
    $project = Project::factory()->for($owner->currentOrganization)->create();
    $user = User::factory()->create();

    if ($case === 'deactivated') {
        $owner->currentOrganization->members()->attach($user, ['role' => 'member', 'deactivated_at' => now()]);
    }

    app(AssignProjectMember::class)->handle($project, $user);
})->with(['outsider', 'deactivated'])->throws(ValidationException::class);
