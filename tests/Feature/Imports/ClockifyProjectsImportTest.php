<?php

use App\Actions\Imports\ImportClockifyProjects;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use App\Services\Imports\ClockifyCsv;
use App\Services\Imports\ClockifyImportPlan;
use App\Services\Imports\ClockifyProjectPlan;
use App\Services\Imports\ClockifyProjectsCsv;
use App\Support\CurrentOrganization;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

const CLOCKIFY_PROJECTS_HEADER = '"Project","Client","Status","Visibility","Tasks","Tracked (h)","Estimated (h)","Remaining (h)","Overage (h)","Progress(%)","Project members","Project manager","Note"';

function clockifyProjects(array $rows): string
{
    return implode("\n", [CLOCKIFY_PROJECTS_HEADER, ...array_map(
        fn (array $row) => implode(',', array_map(fn (string $value) => '"'.str_replace('"', '""', $value).'"', $row)),
        $rows,
    )])."\n";
}

function clockifyProject(string $name, string $client, string $status = 'Active', string $visibility = 'Public', string $estimate = '', string $members = '', string $note = ''): array
{
    return [$name, $client, $status, $visibility, '', '10.00', $estimate, '', '', '', $members, '', $note];
}

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Anna Andersson', 'email' => 'anna@example.com', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    app(CurrentOrganization::class)->set($this->organization);

    $this->csv = clockifyProjects([
        clockifyProject('PO104248', 'Ferroamp', 'Archived', 'Private', members: 'Olivia Owner, Anna Andersson, Okänd Person', note: 'May-Aug 2024'),
        clockifyProject('Löpande', 'Lintex', estimate: '120.50'),
        clockifyProject('Löpande', 'Afonso'),
    ]);
});

it('reads a project export and tells it apart from a time export', function () {
    $csv = ClockifyProjectsCsv::fromString($this->csv);

    expect(ClockifyProjectsCsv::matches($this->csv))->toBeTrue()
        ->and(ClockifyProjectsCsv::matches(clockifyCsv([clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '10:00')])))->toBeFalse()
        ->and($csv->rows)->toHaveCount(3)
        ->and($csv->rows[0])->archived->toBeTrue()->private->toBeTrue()->note->toBe('May-Aug 2024')
        ->and($csv->rows[0]->memberNames)->toBe(['Olivia Owner', 'Anna Andersson', 'Okänd Person'])
        ->and($csv->rows[1])->estimateSeconds->toBe((int) (120.5 * 3600))->archived->toBeFalse();

    expect(fn () => ClockifyProjectsCsv::fromString("Name,Email\nx,y"))->toThrow(ValidationException::class);
});

it('creates projects with status, visibility, note, estimate and members', function () {
    $plan = new ClockifyProjectPlan($this->organization, ClockifyProjectsCsv::fromString($this->csv));
    expect($plan->newClients)->toBe(['Ferroamp', 'Lintex', 'Afonso'])
        ->and($plan->unknownMembers)->toBe(['Okänd Person']);

    $result = app(ImportClockifyProjects::class)->handle($this->organization, ClockifyProjectsCsv::fromString($this->csv), [
        ClockifyImportPlan::projectKey('Afonso', 'Löpande') => false,
    ]);

    expect($result)->toBe(['created' => 3, 'updated' => 0, 'clientsCreated' => 3]);

    $po = Project::query()->forOrganization($this->organization)->where('name', 'PO104248')->with('members')->sole();
    expect($po->isArchived())->toBeTrue()
        ->and($po->slug)->toBe('po104248')
        ->and($po->client()->sole()->slug)->toBe('ferroamp')
        ->and($po->visibility)->toBe(ProjectVisibility::Private)
        ->and($po->notes)->toBe('May-Aug 2024')
        ->and($po->members->pluck('name')->sort()->values()->all())->toBe(['Anna Andersson', 'Olivia Owner']);

    $lintex = Project::query()->whereRelation('client', 'name', 'Lintex')->sole();
    expect($lintex->estimate_seconds)->toBe((int) (120.5 * 3600))
        ->and($lintex->is_billable)->toBeTrue()
        ->and(Project::query()->whereRelation('client', 'name', 'Afonso')->sole()->is_billable)->toBeFalse();
});

it('only archives, makes private and fills in blanks on existing projects', function () {
    $client = Client::factory()->for($this->organization)->create(['name' => 'Ferroamp']);
    $po = Project::factory()->for($this->organization)->for($client)->create(['name' => 'PO104248', 'notes' => 'Egen anteckning', 'estimate_seconds' => 3600]);
    $po->members()->attach($this->member, ['hourly_rate' => 90000]);
    $lintex = Project::factory()->for($this->organization)->for(Client::factory()->for($this->organization)->create(['name' => 'Lintex']))
        ->private()->create(['name' => 'Löpande']);

    $plan = new ClockifyProjectPlan($this->organization, ClockifyProjectsCsv::fromString($this->csv));
    expect($plan->changedProjects())->toHaveCount(2)
        ->and($plan->changedProjects()[0]['changes'])->toBe(['archive', 'private', 'members'])
        // Already private: Clockify's public doesn't make it public; only the estimate is filled in.
        ->and($plan->changedProjects()[1]['changes'])->toBe(['estimate']);

    $result = app(ImportClockifyProjects::class)->handle($this->organization, ClockifyProjectsCsv::fromString($this->csv));
    expect($result)->toBe(['created' => 1, 'updated' => 2, 'clientsCreated' => 1]);

    $po->refresh();
    expect($po->isArchived())->toBeTrue()
        ->and($po->visibility)->toBe(ProjectVisibility::Private)
        ->and($po->notes)->toBe('Egen anteckning')
        ->and($po->estimate_seconds)->toBe(3600)
        // The existing member keeps their project rate; the owner is added.
        ->and($po->members()->whereKey($this->member->id)->sole()->assignment->hourly_rate)->toBe(90000)
        ->and($po->members()->whereKey($this->owner->id)->exists())->toBeTrue()
        ->and($lintex->fresh()->visibility)->toBe(ProjectVisibility::Private);

    // Importing the same file again changes nothing.
    expect(fn () => app(ImportClockifyProjects::class)->handle($this->organization, ClockifyProjectsCsv::fromString($this->csv)))
        ->toThrow(ValidationException::class);
});

it('leaves other organizations\' projects alone', function () {
    $outsider = User::factory()->create();
    $foreign = Project::factory()->for($outsider->currentOrganization)
        ->for(Client::factory()->for($outsider->currentOrganization)->create(['name' => 'Ferroamp']))
        ->create(['name' => 'PO104248']);

    app(ImportClockifyProjects::class)->handle($this->organization, ClockifyProjectsCsv::fromString($this->csv));

    expect($foreign->fresh()->isArchived())->toBeFalse()
        ->and(Project::query()->forOrganization($this->organization)->where('name', 'PO104248')->exists())->toBeTrue();
});

it('lets old time be imported onto the archived projects afterwards', function () {
    app(ImportClockifyProjects::class)->handle($this->organization, ClockifyProjectsCsv::fromString($this->csv));

    $plan = new ClockifyImportPlan($this->organization, $this->owner, ClockifyCsv::fromString(clockifyCsv([
        clockifyRow('PO104248', 'Ferroamp', 'anna@example.com', '06-03-2024', '9:00', '06-03-2024', '17:00'),
    ])));

    // Anna is a member, but assigned to the private project from Clockify's members.
    expect($plan->entries)->toHaveCount(1)
        ->and($plan->projects[0]['isArchived'])->toBeTrue();
});

it('previews and imports a project export through the import page', function () {
    $response = $this->actingAs($this->owner)->post(route('organizations.import.store', $this->organization->slug), [
        'file' => UploadedFile::fake()->createWithContent('Clockify_Project_export.csv', $this->csv),
    ])->assertRedirect();
    $token = basename((string) parse_url((string) $response->headers->get('Location'), PHP_URL_PATH));

    $this->get(route('organizations.import.show', [$this->organization->slug, $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/import')
            ->where('preview', null)
            ->where('projectPreview.newCount', 3)
            ->where('projectPreview.projects.0.archived', true)
            ->where('projectPreview.projects.0.members', ['Olivia Owner', 'Anna Andersson'])
            ->where('projectPreview.unknownMembers', ['Okänd Person']));

    expect(Project::query()->count())->toBe(0);

    $this->post(route('organizations.import.run', [$this->organization->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->organization->slug))
        ->assertInertiaFlash('projectImportResult.created', 3);

    expect(Project::query()->forOrganization($this->organization)->count())->toBe(3);

    // Members can't import.
    $this->actingAs($this->member)->post(route('organizations.import.store', $this->organization->slug), [
        'file' => UploadedFile::fake()->createWithContent('Clockify_Project_export.csv', $this->csv),
    ])->assertForbidden();
});
