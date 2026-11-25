<?php

namespace Tests\Feature\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OrganizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_organizations_index_page_can_be_rendered()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get(route('organizations.index'));

        $response->assertOk();
    }

    public function test_organizations_can_be_created()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->post(route('organizations.store'), [
                'name' => 'Test Organization',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('organizations', [
            'name' => 'Test Organization',
            'currency' => 'SEK',
            'default_hourly_rate' => null,
            'week_starts_on' => 1,
            'timezone' => 'Europe/Stockholm',
        ]);
    }

    public function test_organizations_cannot_be_created_when_the_policy_denies_it()
    {
        $user = User::factory()->create();

        Gate::before(fn ($user, string $ability) => $ability === 'create' ? false : null);

        $response = $this
            ->actingAs($user)
            ->post(route('organizations.store'), [
                'name' => 'Test Organization',
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('organizations', [
            'name' => 'Test Organization',
        ]);
    }

    public function test_organization_slug_uses_next_available_suffix()
    {
        $user = User::factory()->create();

        Organization::factory()->create(['name' => 'Acme', 'slug' => 'acme']);
        Organization::factory()->create(['name' => 'Acme One', 'slug' => 'acme-1']);
        Organization::factory()->create(['name' => 'Acme Ten', 'slug' => 'acme-10']);

        $this
            ->actingAs($user)
            ->post(route('organizations.store'), [
                'name' => 'Acme',
            ]);

        $this->assertDatabaseHas('organizations', [
            'name' => 'Acme',
            'slug' => 'acme-11',
        ]);
    }

    public function test_the_organization_edit_page_can_be_rendered()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($user)
            ->get(route('organizations.edit', $organization));

        $response
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('organizations/edit')
                ->where('members.0.role', OrganizationRole::Owner->value)
                ->where('members.0.role_label', OrganizationRole::Owner->label()),
            );
    }

    public function test_organizations_can_be_updated_by_owners()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create(['name' => 'Original Name']);

        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($user)
            ->patch(route('organizations.update', $organization), [
                'name' => 'Updated Name',
                'currency' => 'EUR',
                'default_hourly_rate' => 95000,
                'week_starts_on' => 7,
                'timezone' => 'Europe/Helsinki',
                'workday_hours' => '7.5',
                'timer_enabled' => false,
            ]);

        $response->assertRedirect(route('organizations.edit', $organization->fresh()));

        $this->assertDatabaseHas('organizations', [
            'id' => $organization->id,
            'name' => 'Updated Name',
            'currency' => 'EUR',
            'default_hourly_rate' => 95000,
            'week_starts_on' => 7,
            'timezone' => 'Europe/Helsinki',
            'workday_seconds' => 27000,
            'timer_enabled' => false,
        ]);
    }

    public function test_organization_settings_are_validated()
    {
        $user = User::factory()->create();
        $organization = $user->currentOrganization;

        $response = $this
            ->actingAs($user)
            ->patch(route('organizations.update', $organization), [
                'name' => 'Valid Name',
                'currency' => 'kronor',
                'default_hourly_rate' => -1,
                'week_starts_on' => 8,
                'timezone' => 'Mars/Olympus',
                'workday_hours' => 25,
            ]);

        $response->assertSessionHasErrors(['currency', 'default_hourly_rate', 'week_starts_on', 'timezone', 'workday_hours']);
    }

    public function test_organizations_cannot_be_updated_by_members()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($member)
            ->patch(route('organizations.update', $organization), [
                'name' => 'Updated Name',
                'currency' => 'SEK',
                'week_starts_on' => 1,
                'timezone' => 'Europe/Stockholm',
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('organizations', ['name' => 'Updated Name']);
    }

    public function test_organizations_can_be_deleted_by_owners()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ]);

        $response->assertRedirect();

        $this->assertSoftDeleted('organizations', [
            'id' => $organization->id,
        ]);
    }

    public function test_organization_deletion_requires_name_confirmation()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $organization), [
                'name' => 'Wrong Name',
            ]);

        $response->assertSessionHasErrors('name');

        $this->assertDatabaseHas('organizations', [
            'id' => $organization->id,
            'deleted_at' => null,
        ]);
    }

    public function test_deleting_current_organization_switches_to_alphabetically_first_remaining_organization()
    {
        // Without the factory's own organization, whose random name could sort before "Alpha".
        $user = User::factory()->withoutOrganization()->create(['name' => 'Mike']);

        $zuluOrganization = Organization::factory()->create(['name' => 'Zulu Organization']);
        $zuluOrganization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $alphaOrganization = Organization::factory()->create(['name' => 'Alpha Organization']);
        $alphaOrganization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $betaOrganization = Organization::factory()->create(['name' => 'Beta Organization']);
        $betaOrganization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $user->update(['current_organization_id' => $zuluOrganization->id]);

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $zuluOrganization), [
                'name' => $zuluOrganization->name,
            ]);

        $response->assertRedirect();

        $this->assertSoftDeleted('organizations', [
            'id' => $zuluOrganization->id,
        ]);

        $this->assertEquals($alphaOrganization->id, $user->fresh()->current_organization_id);
    }

    public function test_deleting_current_organization_falls_back_to_remaining_organization()
    {
        $user = User::factory()->create();
        $remainingOrganization = $user->currentOrganization;
        $organization = Organization::factory()->create(['name' => 'Zulu Organization']);
        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $user->update(['current_organization_id' => $organization->id]);

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ]);

        $response->assertRedirect();

        $this->assertSoftDeleted('organizations', [
            'id' => $organization->id,
        ]);

        $this->assertEquals($remainingOrganization->id, $user->fresh()->current_organization_id);
    }

    public function test_deleting_the_only_organization_clears_the_current_organization()
    {
        $user = User::factory()->create();
        $organization = $user->currentOrganization;

        $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ])
            ->assertRedirect(route('organizations.index'));

        $this->assertSoftDeleted('organizations', ['id' => $organization->id]);
        $this->assertNull($user->fresh()->current_organization_id);
    }

    public function test_deleting_non_current_organization_leaves_current_organization_unchanged()
    {
        $user = User::factory()->create();
        $currentOrganization = $user->currentOrganization;
        $organization = Organization::factory()->create();
        $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ]);

        $response->assertRedirect();

        $this->assertSoftDeleted('organizations', [
            'id' => $organization->id,
        ]);

        $this->assertEquals($currentOrganization->id, $user->fresh()->current_organization_id);
    }

    public function test_members_can_leave_organizations()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($member)
            ->delete(route('organizations.leave', $organization));

        $response->assertRedirect(route('organizations.index'));
        $response->assertInertiaFlash('toast', ['type' => 'success', 'message' => __('You left the organization ":name"', ['name' => $organization->name])]);

        $this->assertFalse($member->fresh()->belongsToOrganization($organization));
    }

    public function test_leaving_current_organization_switches_to_alphabetically_first_remaining_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create(['name' => 'Mike']);

        $zuluOrganization = Organization::factory()->create(['name' => 'Zulu Organization']);
        $zuluOrganization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $zuluOrganization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $alphaOrganization = Organization::factory()->create(['name' => 'Alpha Organization']);
        $alphaOrganization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $betaOrganization = Organization::factory()->create(['name' => 'Beta Organization']);
        $betaOrganization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $member->update(['current_organization_id' => $zuluOrganization->id]);

        $response = $this
            ->actingAs($member)
            ->delete(route('organizations.leave', $zuluOrganization));

        $response->assertRedirect(route('organizations.index'));

        $this->assertFalse($member->fresh()->belongsToOrganization($zuluOrganization));
        $this->assertEquals($alphaOrganization->id, $member->fresh()->current_organization_id);
    }

    public function test_leaving_the_only_organization_clears_the_current_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->withoutOrganization()->create();
        $organization = $owner->currentOrganization;
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
        $member->update(['current_organization_id' => $organization->id]);

        $this
            ->actingAs($member)
            ->delete(route('organizations.leave', $organization))
            ->assertRedirect(route('organizations.index'));

        $this->assertNull($member->fresh()->current_organization_id);
    }

    public function test_organization_owners_cannot_leave_their_organization()
    {
        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $response = $this
            ->actingAs($owner)
            ->delete(route('organizations.leave', $organization));

        $response->assertForbidden();

        $this->assertTrue($owner->fresh()->belongsToOrganization($organization));
    }

    public function test_users_cannot_leave_organizations_they_dont_belong_to()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $response = $this
            ->actingAs($user)
            ->delete(route('organizations.leave', $organization));

        $response->assertForbidden();
    }

    public function test_deleting_organization_switches_other_affected_users_to_their_remaining_organization()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $membersOtherOrganization = $member->currentOrganization;

        $organization = Organization::factory()->create();
        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $owner->update(['current_organization_id' => $organization->id]);
        $member->update(['current_organization_id' => $organization->id]);

        $response = $this
            ->actingAs($owner)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ]);

        $response->assertRedirect();

        $this->assertEquals($membersOtherOrganization->id, $member->fresh()->current_organization_id);
    }

    public function test_organizations_cannot_be_deleted_by_non_owners()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
        $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($member)
            ->delete(route('organizations.destroy', $organization), [
                'name' => $organization->name,
            ]);

        $response->assertForbidden();
    }

    public function test_users_can_switch_organizations()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($user, ['role' => OrganizationRole::Member->value]);

        $response = $this
            ->actingAs($user)
            ->post(route('organizations.switch', $organization));

        $response->assertRedirect();

        $this->assertEquals($organization->id, $user->fresh()->current_organization_id);
    }

    public function test_users_cannot_switch_to_organization_they_dont_belong_to()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $response = $this
            ->actingAs($user)
            ->post(route('organizations.switch', $organization));

        $response->assertForbidden();
    }

    public function test_guests_cannot_access_organizations()
    {
        $response = $this->get(route('organizations.index'));

        $response->assertRedirect(route('login'));
    }
}
