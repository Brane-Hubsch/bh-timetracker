<?php

namespace App\Enums;

enum OrganizationRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';

    /**
     * Get the display label for the role.
     */
    public function label(): string
    {
        return __(ucfirst($this->value));
    }

    /**
     * Get all the permissions for this role.
     *
     * @return array<OrganizationPermission>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::Owner => OrganizationPermission::cases(),
            self::Admin => [
                OrganizationPermission::UpdateOrganization,
                OrganizationPermission::AddMember,
                OrganizationPermission::UpdateMember,
                OrganizationPermission::RemoveMember,
                OrganizationPermission::CreateInvitation,
                OrganizationPermission::CancelInvitation,
                OrganizationPermission::ManageClients,
                OrganizationPermission::ManageProjects,
                OrganizationPermission::ViewRates,
            ],
            self::Member => [],
        };
    }

    /**
     * Determine if the role has the given permission.
     */
    public function hasPermission(OrganizationPermission $permission): bool
    {
        return in_array($permission, $this->permissions());
    }

    /**
     * Get the hierarchy level for this role.
     * Higher numbers indicate higher privileges.
     */
    public function level(): int
    {
        return match ($this) {
            self::Owner => 3,
            self::Admin => 2,
            self::Member => 1,
        };
    }

    /**
     * Check if this role is at least as privileged as another role.
     */
    public function isAtLeast(OrganizationRole $role): bool
    {
        return $this->level() >= $role->level();
    }

    /**
     * Get the roles that can be assigned to organization members (excludes Owner).
     *
     * @return array<array{value: string, label: string}>
     */
    public static function assignable(): array
    {
        $roles = array_filter(self::cases(), fn (self $role) => $role !== self::Owner);

        return array_values(array_map(
            fn (self $role) => ['value' => $role->value, 'label' => $role->label()],
            $roles,
        ));
    }
}
