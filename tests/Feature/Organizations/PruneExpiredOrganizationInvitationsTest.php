<?php

namespace Tests\Feature\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PruneExpiredOrganizationInvitationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_invitations_are_deleted_by_the_scheduled_cleanup(): void
    {
        $this->travelTo(now()->startOfDay());

        $owner = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

        $expiredInvitation = OrganizationInvitation::factory()->expired()->create([
            'organization_id' => $organization->id,
            'invited_by' => $owner->id,
        ]);

        $unexpiredInvitation = OrganizationInvitation::factory()->expiresIn(1)->create([
            'organization_id' => $organization->id,
            'invited_by' => $owner->id,
        ]);

        $invitationWithoutExpiration = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'invited_by' => $owner->id,
        ]);

        $this->artisan('schedule:run')->assertSuccessful();

        $this->assertDatabaseMissing('organization_invitations', [
            'id' => $expiredInvitation->id,
        ]);

        $this->assertDatabaseHas('organization_invitations', [
            'id' => $unexpiredInvitation->id,
        ]);

        $this->assertDatabaseHas('organization_invitations', [
            'id' => $invitationWithoutExpiration->id,
        ]);
    }
}
