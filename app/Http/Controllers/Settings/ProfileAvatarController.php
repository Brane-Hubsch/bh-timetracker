<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Images\UpdateUserAvatar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Images\ImageUploadRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class ProfileAvatarController extends Controller
{
    public function update(ImageUploadRequest $request, #[CurrentUser] User $user, UpdateUserAvatar $updateAvatar): RedirectResponse
    {
        $updateAvatar->handle($user, $request->uploadedImage());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile picture updated.')]);

        return to_route('profile.edit');
    }

    public function destroy(#[CurrentUser] User $user, UpdateUserAvatar $updateAvatar): RedirectResponse
    {
        $updateAvatar->handle($user, null);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile picture removed.')]);

        return to_route('profile.edit');
    }
}
