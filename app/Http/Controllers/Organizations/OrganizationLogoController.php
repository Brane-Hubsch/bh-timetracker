<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Images\UpdateOrganizationLogo;
use App\Http\Controllers\Controller;
use App\Http\Requests\Images\ImageUploadRequest;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OrganizationLogoController extends Controller
{
    public function update(ImageUploadRequest $request, Organization $organization, UpdateOrganizationLogo $updateLogo): RedirectResponse
    {
        Gate::authorize('update', $organization);

        $updateLogo->handle($organization, $request->uploadedImage());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Logo updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    public function destroy(Organization $organization, UpdateOrganizationLogo $updateLogo): RedirectResponse
    {
        Gate::authorize('update', $organization);

        $updateLogo->handle($organization, null);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Logo removed.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }
}
