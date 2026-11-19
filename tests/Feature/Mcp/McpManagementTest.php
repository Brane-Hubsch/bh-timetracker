<?php

use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Mcp\Servers\TimetrackerServer;
use App\Mcp\Tools\ArchiveClientTool;
use App\Mcp\Tools\ArchiveProjectTool;
use App\Mcp\Tools\CancelInvitationTool;
use App\Mcp\Tools\CreateProjectTool;
use App\Mcp\Tools\DeleteTagTool;
use App\Mcp\Tools\ExportReportTool;
use App\Mcp\Tools\InviteMemberTool;
use App\Mcp\Tools\ListMembersTool;
use App\Mcp\Tools\RemoveMemberTool;
use App\Mcp\Tools\RenameTagTool;
use App\Mcp\Tools\UpdateClientTool;
use App\Mcp\Tools\UpdateMemberTool;
use App\Mcp\Tools\UpdateProjectTool;
use App\Models\Client;
use App\Models\Membership;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\Fluent\AssertableJson;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member', 'email' => 'mia@example.com', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value, 'hourly_rate' => 90000]);
    $this->client = Client::factory()->for($this->organization)->create(['name' => 'Acme Retail AB', 'email' => 'faktura@acme.test']);
    $this->project = Project::factory()->for($this->organization)->for($this->client)->create([
        'name' => 'Webbshop',
        'code' => 'ACME-01',
        'is_billable' => true,
        'hourly_rate' => 110000,
        'estimate_seconds' => 100 * 3600,
    ]);
    $this->meeting = Tag::factory()->for($this->organization)->create(['name' => 'Möte']);

    // Another organization whose data must stay out of reach.
    $this->outsider = User::factory()->create(['name' => 'Otto Outsider', 'email' => 'otto@example.com']);
    $this->otherOrganization = $this->outsider->currentOrganization;
});

afterEach(fn () => CarbonImmutable::setTestNow());

function membership(User $user, $organization): Membership
{
    return Membership::query()->where('organization_id', $organization->id)->where('user_id', $user->id)->firstOrFail();
}

describe('members and invitations', function () {
    it('lists members and pending invitations, with rates only for owners and admins', function () {
        OrganizationInvitation::factory()->create(['organization_id' => $this->organization->id, 'email' => 'new@example.com', 'invited_by' => $this->owner->id]);

        TimetrackerServer::actingAs($this->owner)
            ->tool(ListMembersTool::class)
            ->assertOk()
            ->assertStructuredContentPath('members.0.name', 'Mia Member')
            ->assertStructuredContentPath('members.0.hourly_rate', 900)
            ->assertStructuredContentPath('pending_invitations.0.email', 'new@example.com')
            ->assertDontSee('Otto Outsider');

        TimetrackerServer::actingAs($this->member)
            ->tool(ListMembersTool::class)
            ->assertOk()
            ->assertSee('Olivia Owner')
            ->assertDontSee('hourly_rate');
    });

    it('invites a member by email and sends the invitation', function () {
        Notification::fake();

        TimetrackerServer::actingAs($this->owner)
            ->tool(InviteMemberTool::class, ['email' => 'ny@example.com', 'role' => 'admin'])
            ->assertOk()
            ->assertStructuredContentPath('invited.role', 'admin');

        $invitation = OrganizationInvitation::query()->where('email', 'ny@example.com')->sole();
        expect($invitation->organization_id)->toBe($this->organization->id)
            ->and($invitation->role)->toBe(OrganizationRole::Admin);
        Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
    });

    it('does not invite existing members, owners or on behalf of members', function () {
        Notification::fake();

        TimetrackerServer::actingAs($this->owner)
            ->tool(InviteMemberTool::class, ['email' => 'mia@example.com'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(InviteMemberTool::class, ['email' => 'boss@example.com', 'role' => 'owner'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->member)
            ->tool(InviteMemberTool::class, ['email' => 'friend@example.com'])
            ->assertHasErrors();

        expect(OrganizationInvitation::query()->count())->toBe(0);
        Notification::assertNothingSent();
    });

    it('cancels a pending invitation, but not another organization\'s', function () {
        $invitation = OrganizationInvitation::factory()->create(['organization_id' => $this->organization->id, 'email' => 'New@Example.com', 'invited_by' => $this->owner->id]);
        $foreign = OrganizationInvitation::factory()->create(['organization_id' => $this->otherOrganization->id, 'email' => 'other@example.com', 'invited_by' => $this->outsider->id]);

        TimetrackerServer::actingAs($this->member)
            ->tool(CancelInvitationTool::class, ['email' => 'new@example.com'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(CancelInvitationTool::class, ['email' => 'other@example.com'])
            ->assertHasErrors(['No pending invitation for other@example.com']);
        TimetrackerServer::actingAs($this->owner)
            ->tool(CancelInvitationTool::class, ['email' => 'new@example.com'])
            ->assertOk();

        expect(OrganizationInvitation::query()->whereKey($invitation->id)->exists())->toBeFalse()
            ->and(OrganizationInvitation::query()->whereKey($foreign->id)->exists())->toBeTrue();
    });

    it('changes a member\'s role, rate and active status', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'Mia', 'role' => 'admin', 'hourly_rate' => 1000])
            ->assertOk()
            ->assertStructuredContentPath('updated.role', 'admin')
            ->assertStructuredContentPath('updated.hourly_rate', 1000);

        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'mia@example.com', 'hourly_rate' => null, 'active' => false])
            ->assertOk()
            ->assertStructuredContentPath('updated.active', false);

        $membership = membership($this->member, $this->organization);
        expect($membership->role)->toBe(OrganizationRole::Admin)
            ->and($membership->hourly_rate)->toBeNull()
            ->and($membership->isDeactivated())->toBeTrue();

        // Deactivated members can still be found, to reactivate them.
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'Mia', 'active' => true])
            ->assertOk();
        expect(membership($this->member, $this->organization)->isDeactivated())->toBeFalse();
    });

    it('protects the owner and refuses members and other organizations\' users', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'Olivia', 'role' => 'member'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'Olivia', 'active' => false])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => 'Mia'])
            ->assertHasErrors(['Give at least one of role, hourly_rate or active']);
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateMemberTool::class, ['member' => $this->outsider->id, 'role' => 'admin'])
            ->assertHasErrors(['No member with id '.$this->outsider->id]);
        TimetrackerServer::actingAs($this->member)
            ->tool(UpdateMemberTool::class, ['member' => 'Mia', 'role' => 'admin'])
            ->assertHasErrors();

        expect(membership($this->owner, $this->organization)->role)->toBe(OrganizationRole::Owner)
            ->and(membership($this->member, $this->organization)->role)->toBe(OrganizationRole::Member)
            ->and(membership($this->outsider, $this->otherOrganization)->role)->toBe(OrganizationRole::Owner);
    });

    it('removes a member, but never the owner', function () {
        TimetrackerServer::actingAs($this->member)
            ->tool(RemoveMemberTool::class, ['member' => 'Olivia'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(RemoveMemberTool::class, ['member' => 'Olivia'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(RemoveMemberTool::class, ['member' => 'Otto'])
            ->assertHasErrors(['No member matches "Otto"']);
        TimetrackerServer::actingAs($this->owner)
            ->tool(RemoveMemberTool::class, ['member' => 'Mia'])
            ->assertOk()
            ->assertStructuredContentPath('removed.email', 'mia@example.com');

        expect($this->member->fresh()->belongsToOrganization($this->organization))->toBeFalse()
            ->and($this->owner->fresh()->belongsToOrganization($this->organization))->toBeTrue()
            ->and($this->outsider->fresh()->belongsToOrganization($this->otherOrganization))->toBeTrue();
    });
});

describe('tags', function () {
    it('renames a tag and merges it into an existing one', function () {
        $meetings = Tag::factory()->for($this->organization)->create(['name' => 'Möten']);
        $entry = TimeEntry::factory()->by($this->member, $this->project)->create();
        $entry->tags()->attach($meetings);

        TimetrackerServer::actingAs($this->owner)
            ->tool(RenameTagTool::class, ['tag' => 'Möte', 'name' => 'Kundmöte'])
            ->assertOk()
            ->assertStructuredContentPath('renamed.to', 'Kundmöte');

        TimetrackerServer::actingAs($this->owner)
            ->tool(RenameTagTool::class, ['tag' => 'Möten', 'name' => 'kundmöte'])
            ->assertOk()
            ->assertStructuredContentPath('merged.to', 'Kundmöte');

        expect($entry->fresh()->tagNames())->toBe(['Kundmöte'])
            ->and(Tag::query()->forOrganization($this->organization)->pluck('name')->all())->toBe(['Kundmöte']);
    });

    it('deletes a tag but keeps the entries', function () {
        $entry = TimeEntry::factory()->by($this->member, $this->project)->create();
        $entry->tags()->attach($this->meeting);

        TimetrackerServer::actingAs($this->owner)
            ->tool(DeleteTagTool::class, ['tag' => 'möte'])
            ->assertOk()
            ->assertStructuredContentPath('deleted.removed_from_entries', 1);

        expect(Tag::query()->whereKey($this->meeting->id)->exists())->toBeFalse()
            ->and($entry->fresh()->tagNames())->toBe([]);
    });

    it('lets only owners and admins manage tags in their own organization', function () {
        $foreign = Tag::factory()->for($this->otherOrganization)->create(['name' => 'Hemlig']);

        TimetrackerServer::actingAs($this->member)
            ->tool(RenameTagTool::class, ['tag' => 'Möte', 'name' => 'Annat'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->member)
            ->tool(DeleteTagTool::class, ['tag' => 'Möte'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(DeleteTagTool::class, ['tag' => $foreign->id])
            ->assertHasErrors(['No tag with id '.$foreign->id]);

        expect($this->meeting->fresh()->name)->toBe('Möte')
            ->and($foreign->fresh())->not->toBeNull();
    });
});

describe('clients and projects', function () {
    it('updates only the given client fields and clears with null', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateClientTool::class, ['client' => 'Acme', 'name' => 'Acme Retail Group AB', 'email' => null])
            ->assertOk()
            ->assertStructuredContentPath('updated.name', 'Acme Retail Group AB');

        $client = $this->client->fresh();
        expect($client->name)->toBe('Acme Retail Group AB')
            ->and($client->email)->toBeNull();
    });

    it('archives and restores clients and projects', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(ArchiveClientTool::class, ['client' => 'Acme'])
            ->assertOk()
            ->assertStructuredContentPath('archived.name', 'Acme Retail AB');
        TimetrackerServer::actingAs($this->owner)
            ->tool(ArchiveProjectTool::class, ['project' => 'Webbshop'])
            ->assertOk();

        expect($this->client->fresh()->archived_at)->not->toBeNull()
            ->and($this->project->fresh()->archived_at)->not->toBeNull();

        TimetrackerServer::actingAs($this->owner)
            ->tool(ArchiveClientTool::class, ['client' => 'Acme', 'archived' => false])
            ->assertOk()
            ->assertStructuredContentPath('restored.name', 'Acme Retail AB');
        TimetrackerServer::actingAs($this->owner)
            ->tool(ArchiveProjectTool::class, ['project' => 'Webbshop', 'archived' => false])
            ->assertOk();

        expect($this->client->fresh()->archived_at)->toBeNull()
            ->and($this->project->fresh()->archived_at)->toBeNull();
    });

    it('updates only the given project fields', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateProjectTool::class, [
                'project' => 'Webbshop',
                'name' => 'Webbshop 2.0',
                'estimate_hours' => 120,
                'private' => true,
                'notes' => 'Kontakt: Anna',
                'hourly_rate' => null,
            ])
            ->assertOk()
            ->assertStructuredContentPath('updated.estimate_hours', 120);

        $project = $this->project->fresh();
        expect($project->name)->toBe('Webbshop 2.0')
            ->and($project->estimate_seconds)->toBe(120 * 3600)
            ->and($project->visibility)->toBe(ProjectVisibility::Private)
            ->and($project->notes)->toBe('Kontakt: Anna')
            ->and($project->hourly_rate)->toBeNull()
            // Untouched fields keep their values.
            ->and($project->client_id)->toBe($this->client->id)
            ->and($project->code)->toBe('ACME-01')
            ->and($project->is_billable)->toBeTrue();

        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateProjectTool::class, ['project' => $project->id, 'client' => null])
            ->assertOk();
        expect($project->fresh()->client_id)->toBeNull();
    });

    it('validates project changes', function () {
        Project::factory()->for($this->organization)->create(['name' => 'Intern tid', 'code' => 'INT']);

        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateProjectTool::class, ['project' => 'Webbshop', 'code' => 'INT'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateProjectTool::class, ['project' => 'Webbshop', 'starts_on' => '2026-12-01', 'ends_on' => '2026-11-01'])
            ->assertHasErrors(['The end date must be on or after the start date']);
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateProjectTool::class, ['project' => 'Webbshop'])
            ->assertHasErrors(['Give at least one field to change.']);

        expect($this->project->fresh()->code)->toBe('ACME-01');
    });

    it('lets only owners and admins change clients and projects in their own organization', function () {
        $foreignClient = Client::factory()->for($this->otherOrganization)->create(['name' => 'Hemlig kund']);
        $foreignProject = Project::factory()->for($this->otherOrganization)->create(['name' => 'Hemligt']);

        TimetrackerServer::actingAs($this->member)
            ->tool(UpdateProjectTool::class, ['project' => 'Webbshop', 'name' => 'Mitt'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->member)
            ->tool(ArchiveProjectTool::class, ['project' => 'Webbshop'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->member)
            ->tool(UpdateClientTool::class, ['client' => 'Acme', 'name' => 'Mitt'])
            ->assertHasErrors();
        TimetrackerServer::actingAs($this->owner)
            ->tool(UpdateClientTool::class, ['client' => $foreignClient->id, 'name' => 'Stulen'])
            ->assertHasErrors(['No client with id '.$foreignClient->id]);
        TimetrackerServer::actingAs($this->owner)
            ->tool(ArchiveProjectTool::class, ['project' => $foreignProject->id])
            ->assertHasErrors(['No project with id '.$foreignProject->id]);

        expect($this->project->fresh()->name)->toBe('Webbshop')
            ->and($this->project->fresh()->archived_at)->toBeNull()
            ->and($this->client->fresh()->name)->toBe('Acme Retail AB')
            ->and($foreignClient->fresh()->name)->toBe('Hemlig kund')
            ->and($foreignProject->fresh()->archived_at)->toBeNull();
    });

    it('creates projects with notes', function () {
        TimetrackerServer::actingAs($this->owner)
            ->tool(CreateProjectTool::class, ['name' => 'Kampanj', 'notes' => 'Underlag i Drive'])
            ->assertOk();

        expect(Project::query()->where('name', 'Kampanj')->sole()->notes)->toBe('Underlag i Drive');
    });
});

describe('report export', function () {
    it('links to the export with the filters resolved to ids', function () {
        $downloadUrl = null;

        TimetrackerServer::actingAs($this->owner)
            ->tool(ExportReportTool::class, [
                'type' => 'summary',
                'format' => 'pdf',
                'period' => 'last_month',
                'projects' => ['Webbshop'],
                'tags' => ['möte'],
                'group_by' => 'project',
            ])
            ->assertOk()
            ->assertStructuredContent(function (AssertableJson $json) use (&$downloadUrl) {
                $json->where('download_url', function (string $url) use (&$downloadUrl) {
                    $downloadUrl = $url;

                    return true;
                })
                    ->where('report_url', fn (string $url) => str_contains($url, '/'.$this->organization->slug.'/reports?'))
                    ->where('period.from', '2026-10-01')
                    ->where('period.to', '2026-10-31')
                    ->etc();
            });

        parse_str((string) parse_url((string) $downloadUrl, PHP_URL_QUERY), $query);
        expect($query)->toMatchArray([
            'type' => 'summary',
            'format' => 'pdf',
            'period' => 'custom',
            'from' => '2026-10-01',
            'to' => '2026-10-31',
            'projects' => [(string) $this->project->id],
            'tags' => [(string) $this->meeting->id],
            'group' => 'project',
        ]);

        // The link works for the signed-in user and returns the file.
        $this->actingAs($this->owner)
            ->get((string) $downloadUrl)
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    });

    it('does not resolve another organization\'s data or other members for members', function () {
        $foreignProject = Project::factory()->for($this->otherOrganization)->create(['name' => 'Hemligt']);

        TimetrackerServer::actingAs($this->owner)
            ->tool(ExportReportTool::class, ['projects' => [$foreignProject->id]])
            ->assertHasErrors(['No project with id '.$foreignProject->id]);
        TimetrackerServer::actingAs($this->member)
            ->tool(ExportReportTool::class, ['members' => ['Olivia']])
            ->assertHasErrors(['Only owners and admins']);
    });
});
