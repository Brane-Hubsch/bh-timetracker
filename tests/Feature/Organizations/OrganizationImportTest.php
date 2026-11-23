<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create(['email' => 'olivia@example.com']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['email' => 'anna@example.com', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->slug = $this->organization->slug;

    $this->csv = clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '11-30-2026', '9:00', '11-30-2026', '17:00', 'installer app', 'Utveckling'),
        clockifyRow('Kontoret', '', 'olivia@example.com', '11-27-2026', '9:00', '11-27-2026', '12:00'),
        clockifyRow('Webbshop', 'Acme', 'dennis@example.com', '11-26-2026', '9:00', '11-26-2026', '10:00', user: 'Dennis'),
    ]);

    $this->upload = fn (User $user, ?string $csv = null) => $this->actingAs($user)->post(
        route('organizations.import.store', $this->slug),
        ['file' => UploadedFile::fake()->createWithContent('Clockify_Time_Report.csv', $csv ?? $this->csv)],
    );
});

function importToken(string $location): string
{
    return basename((string) parse_url($location, PHP_URL_PATH));
}

it('shows the upload step to owners and admins only', function () {
    $this->actingAs($this->owner)
        ->get(route('organizations.import.create', $this->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('organizations/import')->where('preview', null));

    $this->actingAs($this->member)->get(route('organizations.import.create', $this->slug))->assertForbidden();
    ($this->upload)($this->member)->assertForbidden();
});

it('uploads an export and previews what will be imported', function () {
    $response = ($this->upload)($this->owner)->assertRedirect();
    $token = importToken((string) $response->headers->get('Location'));

    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/import')
            ->where('preview.rows', 3)
            ->where('preview.importable', 2)
            ->where('preview.skippedCount', 1)
            ->where('preview.skippedReasons.0.count', 1)
            ->where('preview.from', '2026-11-26')
            ->where('preview.newClients', ['Acme'])
            ->where('preview.members.2.email', 'dennis@example.com')
            ->where('preview.members.2.memberId', null)
            ->where('preview.projects.0.isNew', true)
            ->has('memberOptions', 2));

    // Nothing is saved before the import.
    expect(TimeEntry::query()->count())->toBe(0)
        ->and(Project::query()->count())->toBe(0);
});

it('recomputes the preview with the chosen members', function () {
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $this->get(route('organizations.import.show', [$this->slug, $token, 'members' => [
        ['email' => 'dennis@example.com', 'member' => (string) $this->member->id],
        ['email' => 'olivia@example.com', 'member' => 'skip'],
    ]]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.importable', 2)
            ->where('preview.members.2.memberId', $this->member->id)
            ->where('preview.members.1.memberId', null));
});

it('imports with the chosen members and billable settings and reports the result', function () {
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $this->post(route('organizations.import.run', [$this->slug, $token]), [
        'members' => [['email' => 'dennis@example.com', 'member' => (string) $this->member->id]],
        'projects' => [['key' => '|kontoret', 'billable' => false]],
    ])
        ->assertRedirect(route('organizations.import.create', $this->slug))
        ->assertInertiaFlash('importResult.created', 3)
        ->assertInertiaFlash('importResult.projectsCreated', 2)
        ->assertInertiaFlash('importResult.skippedCount', 0);

    expect(TimeEntry::query()->where('user_id', $this->member->id)->count())->toBe(2)
        ->and(Project::query()->where('name', 'Kontoret')->sole()->is_billable)->toBeFalse();

    // The upload is gone after the import.
    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->slug))
        ->assertInertiaFlash('toast.type', 'warning');
});

it('rejects files that are not Clockify exports', function () {
    ($this->upload)($this->owner, "Name,Hours\nAnna,8\n")->assertSessionHasErrors('file');
});

it('keeps an upload private to the user and organization that made it', function () {
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $admin = User::factory()->withoutOrganization()->create(['current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
    $outsider = User::factory()->create();

    // Another admin in the same organization can't read or import it.
    $this->actingAs($admin)
        ->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->slug));
    $this->actingAs($admin)
        ->post(route('organizations.import.run', [$this->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->slug));

    // Someone outside the organization can't reach it at all.
    $this->actingAs($outsider)
        ->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertForbidden();

    expect(TimeEntry::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('cancels an upload', function () {
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $this->delete(route('organizations.import.destroy', [$this->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->slug));

    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertRedirect(route('organizations.import.create', $this->slug));
});

it('prefills each member\'s rate per project from the rate order', function () {
    $this->organization->update(['default_hourly_rate' => 90000]);
    $this->organization->members()->updateExistingPivot($this->member->id, ['hourly_rate' => 95000]);
    $client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    $webbshop = Project::factory()->for($this->organization)->for($client)->create(['name' => 'Webbshop', 'hourly_rate' => 110000]);
    $webbshop->members()->attach($this->member, ['hourly_rate' => 120000]);
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.currency', 'SEK')
            // Existing project: the member's rate on the project.
            ->where('preview.projects.0.name', 'Webbshop')
            ->where('preview.projects.0.rates.0.memberId', $this->member->id)
            ->where('preview.projects.0.rates.0.defaultRate', 120000)
            ->where('preview.projects.0.rates.0.seconds', 8 * 3600)
            // New project: the organization's default.
            ->where('preview.projects.1.name', 'Kontoret')
            ->where('preview.projects.1.rates.0.memberId', $this->owner->id)
            ->where('preview.projects.1.rates.0.defaultRate', 90000));
});

it('imports with chosen rates and updates entries imported before when asked', function () {
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));
    $this->post(route('organizations.import.run', [$this->slug, $token]))->assertRedirect();
    expect(TimeEntry::query()->where('user_id', $this->member->id)->sole()->hourly_rate)->toBeNull();

    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));
    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.importable', 0)
            ->where('preview.alreadyImported', 2));

    $this->post(route('organizations.import.run', [$this->slug, $token]), [
        'rates' => [['project' => 'acme|webbshop', 'member' => $this->member->id, 'rate' => 125000]],
        'update_existing' => true,
    ])
        ->assertRedirect(route('organizations.import.create', $this->slug))
        ->assertInertiaFlash('importResult.created', 0)
        ->assertInertiaFlash('importResult.updated', 1);

    expect(TimeEntry::query()->where('user_id', $this->member->id)->sole()->hourly_rate)->toBe(125000)
        ->and(TimeEntry::query()->count())->toBe(2);
});

it('offers pending invitations as people to put time on, matching them on email', function () {
    $invitation = OrganizationInvitation::factory()->for($this->organization)->create(['email' => 'dennis@example.com', 'invited_by' => $this->owner->id]);
    OrganizationInvitation::factory()->for($this->organization)->expired()->create(['email' => 'old@example.com', 'invited_by' => $this->owner->id]);
    $token = importToken((string) ($this->upload)($this->owner)->headers->get('Location'));

    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.importable', 3)
            ->where('preview.members.2.email', 'dennis@example.com')
            ->where('preview.members.2.memberId', -$invitation->id)
            ->has('memberOptions', 3)
            ->where('memberOptions.2.value', (string) -$invitation->id));

    // Nothing is saved before the import.
    expect(User::query()->where('email', 'dennis@example.com')->exists())->toBeFalse();
});

it('tells how many rows are longer than 24 hours and split at midnight', function () {
    $csv = clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '06-22-2026', '8:30', '06-23-2026', '16:30'),
    ]);
    $token = importToken((string) ($this->upload)($this->owner, $csv)->headers->get('Location'));

    $this->get(route('organizations.import.show', [$this->slug, $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.splitRows', 1)
            ->where('preview.importable', 2)
            ->where('preview.importableSeconds', 32 * 3600)
            ->where('preview.skippedCount', 0));
});
