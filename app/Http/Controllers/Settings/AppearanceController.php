<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Settings\UpdateAppearance;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\AppearanceUpdateRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;

class AppearanceController extends Controller
{
    public function update(AppearanceUpdateRequest $request, #[CurrentUser] User $user, UpdateAppearance $update): RedirectResponse
    {
        $update->handle($user, $request->preferences());

        return back();
    }
}
