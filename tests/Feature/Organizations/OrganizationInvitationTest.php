<?php

namespace Tests\Feature\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrganizationInvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_invitations_can_be_created()
    {
        Notification::fake();

        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($owner)
            ->post(route('organizations.invitations.store', $organization), [
                'email' => 'invited@example.com',
                'role' => OrganizationRole::Member->value,
            ]);

        $response->assertRedirect(route('organizations.edit', $organization));

        $this->assertDatabaseHas('organization_invitations', [
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'role' => OrganizationRole::Member->value,
        ]);
    }

    public function test_invitation_email_for_existing_users_uses_login_route()
    {
        $owner = User::factory()->create();
        $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => $invitedUser->email,
            'invited_by' => $owner->id,
        ]);

        $mail = (new OrganizationInvitationNotification($invitation))->toMail($invitedUser);

        $this->assertSame(route('login', ['invitation' => $invitation->code]), $mail->actionUrl);
        $this->assertStringContainsString('dashboard', implode(' ', $mail->introLines));
    }

    public function test_invitation_email_for_unknown_users_uses_login_route()
    {
        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'unknown@example.com',
            'invited_by' => $owner->id,
        ]);

        $mail = (new OrganizationInvitationNotification($invitation))->toMail((object) []);

        $this->assertSame(route('login', ['invitation' => $invitation->code]), $mail->actionUrl);
        $this->assertStringContainsString('log in', strtolower(implode(' ', $mail->introLines)));
    }

    public function test_organization_invitations_can_be_created_by_admins()
    {
        Notification::fake();

        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);

        $response = $this
            ->actingAs($admin)
            ->post(route('organizations.invitations.store', $organization), [
                'email' => 'invited@example.com',
                'role' => OrganizationRole::Member->value,
            ]);

        $response->assertRedirect(route('organizations.edit', $organization));
    }

    public function test_existing_organization_members_cannot_be_invited()
    {
        Notification::fake();

        $owner = User::factory()->create();
        $member = User::factory()->create(['email' => 'member@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($owner)
            ->post(route('organizations.invitations.store', $organization), [
                'email' => 'member@example.com',
                'role' => OrganizationRole::Member->value,
            ]);

        $response->assertSessionHasErrors('email');
    }

    public function test_duplicate_invitations_cannot_be_created()
    {
        Notification::fake();

        $owner = User::factory()->create();
        $organization = Organization::factory()->create();
        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($owner)
            ->post(route('organizations.invitations.store', $organization), [
                'email' => 'invited@example.com',
                'role' => OrganizationRole::Member->value,
            ]);

        $response->assertSessionHasErrors('email');
    }

    public function test_organization_invitations_cannot_be_created_by_members()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($member)
            ->post(route('organizations.invitations.store', $organization), [
                'email' => 'invited@example.com',
                'role' => OrganizationRole::Member->value,
            ]);

        $response->assertForbidden();
    }

    public function test_organization_invitations_can_be_cancelled_by_owners()
    {
        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($owner)
            ->delete(route('organizations.invitations.destroy', [$organization, $invitation]));

        $response->assertRedirect(route('organizations.edit', $organization));

        $this->assertDatabaseMissing('organization_invitations', [
            'id' => $invitation->id,
        ]);
    }

    public function test_organization_invitations_can_be_accepted()
    {
        $owner = User::factory()->create();
        $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'role' => OrganizationRole::Member,
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($invitedUser)
            ->post(route('invitations.accept', $invitation));

        $response->assertRedirect(route('dashboard'));
        $response->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Invitation accepted.']);

        $this->assertTrue($invitedUser->fresh()->belongsToOrganization($organization));
        $this->assertNotNull($invitation->fresh()->accepted_at);
    }

    public function test_organization_invitations_can_be_declined_by_the_invited_user()
    {
        $owner = User::factory()->create();
        $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($invitedUser)
            ->delete(route('invitations.decline', $invitation));

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseMissing('organization_invitations', [
            'id' => $invitation->id,
        ]);
    }

    public function test_organization_invitations_cannot_be_declined_by_uninvited_user()
    {
        $owner = User::factory()->create();
        $uninvitedUser = User::factory()->create(['email' => 'uninvited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($uninvitedUser)
            ->delete(route('invitations.decline', $invitation));

        $response->assertSessionHasErrors('invitation');

        $this->assertDatabaseHas('organization_invitations', [
            'id' => $invitation->id,
        ]);
    }

    public function test_accepted_organization_invitations_cannot_be_declined()
    {
        $owner = User::factory()->create();
        $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->accepted()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($invitedUser)
            ->delete(route('invitations.decline', $invitation));

        $response->assertSessionHasErrors('invitation');

        $this->assertDatabaseHas('organization_invitations', [
            'id' => $invitation->id,
        ]);
    }

    public function test_organization_invitations_cannot_be_accepted_by_uninvited_user()
    {
        $owner = User::factory()->create();
        $uninvitedUser = User::factory()->create(['email' => 'uninvited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($uninvitedUser)
            ->post(route('invitations.accept', $invitation));

        $response->assertSessionHasErrors('invitation');

        $this->assertFalse($uninvitedUser->fresh()->belongsToOrganization($organization));
    }

    public function test_expired_invitations_cannot_be_accepted()
    {
        $owner = User::factory()->create();
        $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $invitation = OrganizationInvitation::factory()->expired()->create([
            'organization_id' => $organization->id,
            'email' => 'invited@example.com',
            'invited_by' => $owner->id,
        ]);

        $response = $this
            ->actingAs($invitedUser)
            ->post(route('invitations.accept', $invitation));

        $response->assertSessionHasErrors('invitation');

        $this->assertFalse($invitedUser->fresh()->belongsToOrganization($organization));
    }
}
