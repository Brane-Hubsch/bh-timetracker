<?php

namespace App\Support;

use App\Exceptions\MissingCurrentOrganizationException;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Contracts\Auth\Factory as AuthFactory;

/**
 * The active organization (tenant) for the current request, job or MCP call.
 *
 * Tenant routes set it from the `{current_organization}` URL segment (see EnsureOrganizationMembership).
 * Elsewhere it falls back to the authenticated user's current organization. Registered as a scoped
 * singleton, so it is reset between requests and queued jobs.
 */
class CurrentOrganization
{
    private ?Organization $organization = null;

    private bool $resolved = false;

    public function __construct(private readonly AuthFactory $auth)
    {
        //
    }

    /**
     * Set the active organization explicitly.
     */
    public function set(Organization $organization): void
    {
        $this->organization = $organization;
        $this->resolved = true;
    }

    /**
     * Clear the active organization (it will be resolved again on next access).
     */
    public function forget(): void
    {
        $this->organization = null;
        $this->resolved = false;
    }

    /**
     * Get the active organization, if any.
     */
    public function get(): ?Organization
    {
        if (! $this->resolved) {
            $this->organization = $this->resolveFromAuthenticatedUser();
            $this->resolved = true;
        }

        return $this->organization;
    }

    /**
     * Get the active organization or fail.
     *
     * @throws MissingCurrentOrganizationException
     */
    public function getOrFail(): Organization
    {
        return $this->get() ?? throw new MissingCurrentOrganizationException;
    }

    /**
     * Get the active organization's id, if any.
     */
    public function id(): ?int
    {
        return $this->get()?->id;
    }

    /**
     * Determine whether there is an active organization.
     */
    public function has(): bool
    {
        return $this->get() !== null;
    }

    private function resolveFromAuthenticatedUser(): ?Organization
    {
        $user = $this->auth->guard()->user();

        if (! $user instanceof User || $user->current_organization_id === null) {
            return null;
        }

        $organization = $user->currentOrganization;

        return $organization && $user->belongsToOrganization($organization) ? $organization : null;
    }
}
