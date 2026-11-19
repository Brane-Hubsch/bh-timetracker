<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Organization;
use App\Models\Tag;
use App\Models\User;

/**
 * Everyone in an organization uses (and creates) tags when reporting time; owners and admins manage
 * the list: create, rename (or merge) and delete.
 */
class TagPolicy
{
    public function manage(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTags);
    }

    public function update(User $user, Tag $tag): bool
    {
        return $user->hasOrganizationPermission($tag->organization, OrganizationPermission::ManageTags);
    }

    public function delete(User $user, Tag $tag): bool
    {
        return $this->update($user, $tag);
    }
}
