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

    public function test_organization_member_roles_cannot_be_updated_by_non_owners()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($admin)
            ->patch(route('organizations.members.update', [$organization, $member]), [
                'role' => OrganizationRole::Admin->value,
            ]);

        $response->assertForbidden();
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

    public function test_organization_members_cannot_be_removed_by_non_owners()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($admin)
            ->delete(route('organizations.members.destroy', [$organization, $member]));

        $response->assertForbidden();
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

    public function test_removed_member_current_organization_is_set_to_personal_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $personalOrganization = $member->personalOrganization();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $member->update(['current_organization_id' => $organization->id]);

        $this
            ->actingAs($owner)
            ->delete(route('organizations.members.destroy', [$organization, $member]));

        $this->assertEquals($personalOrganization->id, $member->fresh()->current_organization_id);
    }
}
