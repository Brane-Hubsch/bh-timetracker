<?php

namespace Tests\Feature\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationMemberTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_member_roles_can_be_updated_by_owners()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($owner)
            ->patch(route('organizations.members.update', [$organization, $member]), [
                'role' => OrganizationRole::Admin->value,
            ]);

        $response->assertRedirect(route('organizations.edit', $organization));

        $this->assertEquals(
            OrganizationRole::Admin->value,
            $organization->members()->where('user_id', $member->id)->first()->pivot->role->value,
        );
    }

    public function test_organization_member_roles_can_be_updated_by_admins()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $this
            ->actingAs($admin)
            ->patch(route('organizations.members.update', [$organization, $member]), [
                'role' => OrganizationRole::Admin->value,
            ])
            ->assertRedirect();

        $this->assertSame(OrganizationRole::Admin, $member->organizationRole($organization));
    }

    public function test_organization_member_roles_cannot_be_updated_by_members()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $otherMember = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
        $organization->members()->attach($otherMember, ['role' => OrganizationRole::Member->value]);

        $this
            ->actingAs($member)
            ->patch(route('organizations.members.update', [$organization, $otherMember]), [
                'role' => OrganizationRole::Admin->value,
            ])
            ->assertForbidden();
    }

    public function test_the_owner_role_cannot_be_changed_by_admins()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);

        $this
            ->actingAs($admin)
            ->patch(route('organizations.members.update', [$organization, $owner]), [
                'role' => OrganizationRole::Member->value,
            ])
            ->assertForbidden();

        $this->assertSame(OrganizationRole::Owner, $owner->organizationRole($organization));
    }

    public function test_organization_members_can_be_removed_by_owners()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($owner)
            ->delete(route('organizations.members.destroy', [$organization, $member]));

        $response->assertRedirect(route('organizations.edit', $organization));

        $this->assertFalse($member->fresh()->belongsToOrganization($organization));
    }

    public function test_organization_members_can_be_removed_by_admins()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $this
            ->actingAs($admin)
            ->delete(route('organizations.members.destroy', [$organization, $member]))
            ->assertRedirect();

        $this->assertFalse($member->fresh()->belongsToOrganization($organization));
    }

    public function test_organization_members_cannot_be_removed_by_members()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $otherMember = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
        $organization->members()->attach($otherMember, ['role' => OrganizationRole::Member->value]);

        $this
            ->actingAs($member)
            ->delete(route('organizations.members.destroy', [$organization, $otherMember]))
            ->assertForbidden();

        $this->assertTrue($otherMember->fresh()->belongsToOrganization($organization));
    }

    public function test_organization_owner_cannot_be_removed()
    {
        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($owner)
            ->delete(route('organizations.members.destroy', [$organization, $owner]));

        $response->assertForbidden();

        $this->assertTrue($owner->fresh()->belongsToOrganization($organization));
    }

    public function test_organization_member_role_cannot_be_set_to_owner()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($owner)
            ->patch(route('organizations.members.update', [$organization, $member]), [
                'role' => OrganizationRole::Owner->value,
            ]);

        $response->assertSessionHasErrors('role');

        $this->assertEquals(
            OrganizationRole::Member->value,
            $organization->members()->where('user_id', $member->id)->first()->pivot->role->value,
        );
    }

    public function test_removed_member_current_organization_falls_back_to_another_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $otherOrganization = $member->currentOrganization;
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $member->update(['current_organization_id' => $organization->id]);

        $this
            ->actingAs($owner)
            ->delete(route('organizations.members.destroy', [$organization, $member]));

        $this->assertEquals($otherOrganization->id, $member->fresh()->current_organization_id);
    }

    public function test_removed_member_without_other_organizations_has_no_current_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->withoutOrganization()->create();
        $organization = $owner->currentOrganization;

        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
        $member->update(['current_organization_id' => $organization->id]);

        $this
            ->actingAs($owner)
            ->delete(route('organizations.members.destroy', [$organization, $member]));

        $this->assertNull($member->fresh()->current_organization_id);
        $this->assertFalse($member->fresh()->belongsToOrganization($organization));
    }
}
