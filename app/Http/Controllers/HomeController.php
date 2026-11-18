<?php

namespace App\Http\Controllers;

use App\Http\Responses\Concerns\RedirectsToCurrentOrganization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    use RedirectsToCurrentOrganization;

    /**
     * There is no public landing page: guests go to login, members to their organization.
     */
    public function __invoke(Request $request): RedirectResponse
    {
        if (! $request->user()) {
            return to_route('login');
        }

        return redirect($this->redirectPathForCurrentOrganization($request, '/dashboard'));
    }
}
