<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Settings\UpdateSidebarVisibility;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\SidebarVisibilityRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;

class SidebarVisibilityController extends Controller
{
    public function __invoke(SidebarVisibilityRequest $request, #[CurrentUser] User $user, UpdateSidebarVisibility $update): RedirectResponse
    {
        $update->handle($user, $request->item(), $request->boolean('visible'), $request->legacyHiddenItems());

        return back();
    }
}
