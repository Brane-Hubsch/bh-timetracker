<?php

namespace App\Http\Requests\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Rules\UniqueOrganizationInvitation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateOrganizationInvitationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');

        abort_if(! $organization instanceof Organization, 404);

        return [
            'from_team' => ['sometimes', 'boolean'],
            'email' => ['required', 'string', 'email', 'max:255', new UniqueOrganizationInvitation($organization)],
            // Ownership can never be granted through an invitation.
            'role' => ['required', 'string', Rule::enum(OrganizationRole::class)->except([OrganizationRole::Owner])],
        ];
    }

    /**
     * The validated email address to invite.
     */
    public function invitationEmail(): string
    {
        return $this->string('email')->trim()->value();
    }

    /**
     * The validated role for the invitee.
     */
    public function role(): OrganizationRole
    {
        return OrganizationRole::from($this->string('role')->value());
    }
}
