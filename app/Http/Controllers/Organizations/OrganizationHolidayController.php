<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Holidays\AddSwedishHolidays;
use App\Actions\Holidays\CreateHoliday;
use App\Actions\Holidays\DeleteHoliday;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\AddSwedishHolidaysRequest;
use App\Http\Requests\Organizations\HolidayRequest;
use App\Models\Holiday;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * The organization's holidays (owners and admins): days that aren't working days.
 */
class OrganizationHolidayController extends Controller
{
    public function store(HolidayRequest $request, Organization $organization, CreateHoliday $createHoliday): RedirectResponse
    {
        Gate::authorize('update', $organization);

        $createHoliday->handle($organization, $request->holidayDate(), $request->holidayName());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Holiday added.')]);

        return back();
    }

    public function swedish(AddSwedishHolidaysRequest $request, Organization $organization, AddSwedishHolidays $addSwedishHolidays): RedirectResponse
    {
        Gate::authorize('update', $organization);

        $added = $addSwedishHolidays->handle($organization, $request->year());

        Inertia::flash('toast', ['type' => 'success', 'message' => $added === 0
            ? __('All Swedish holidays of :year are already there.', ['year' => $request->year()])
            : trans_choice(':count holiday added.|:count holidays added.', $added, ['count' => $added])]);

        return back();
    }

    public function destroy(Organization $organization, int $holiday, DeleteHoliday $deleteHoliday): RedirectResponse
    {
        Gate::authorize('update', $organization);

        // Looked up within this organization: other organizations' holidays give 404.
        $deleteHoliday->handle(Holiday::query()->forOrganization($organization)->findOrFail($holiday));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Holiday deleted.')]);

        return back();
    }
}
