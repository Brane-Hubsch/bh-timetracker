<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Settings\UpdateSidebarOrder;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\SidebarOrderRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;

class SidebarOrderController extends Controller
{
    public function __invoke(SidebarOrderRequest $request, #[CurrentUser] User $user, UpdateSidebarOrder $update): RedirectResponse
    {
        $update->handle($user, $request->order(), $request->boolean('import'));

        return back();
    }
}
