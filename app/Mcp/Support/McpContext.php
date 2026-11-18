<?php

namespace App\Mcp\Support;

use App\Enums\OrganizationPermission;
use App\Models\Organization;
use App\Models\User;
use App\Support\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;

/**
 * The signed-in user and the organization a tool call acts in. Tools take an optional
 * `organization` slug; without it the user's last used organization is used. Tools always act as
 * the user, with the same policies as the web app.
 */
final readonly class McpContext
{
    public function __construct(
        public User $user,
        public Organization $organization,
    ) {
        //
    }

    public static function from(Request $request): self
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $organization = self::organization($user, $request->get('organization'));
        app(CurrentOrganization::class)->set($organization);

        return new self($user, $organization);
    }

    public function timezone(): string
    {
        return $this->user->timezone;
    }

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->timezone())->startOfDay();
    }

    public function can(OrganizationPermission $permission): bool
    {
        return $this->user->hasOrganizationPermission($this->organization, $permission);
    }

    private static function organization(User $user, mixed $slug): Organization
    {
        $organizations = $user->organizations()->orderBy('name')->get();

        if (is_string($slug) && $slug !== '') {
            return $organizations->firstWhere('slug', $slug) ?? throw ValidationException::withMessages([
                'organization' => sprintf(
                    'You are not a member of an organization "%s". Your organizations: %s.',
                    $slug,
                    $organizations->map(fn (Organization $organization) => "{$organization->name} ({$organization->slug})")->join(', ') ?: 'none',
                ),
            ]);
        }

        return $organizations->firstWhere('id', $user->current_organization_id)
            ?? $organizations->first()
            ?? throw ValidationException::withMessages(['organization' => 'You are not a member of any organization.']);
    }
}
