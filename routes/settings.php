<?php

use App\Http\Controllers\Organizations\OrganizationController;
use App\Http\Controllers\Organizations\OrganizationInvitationController;
use App\Http\Controllers\Organizations\OrganizationMemberController;
use App\Http\Controllers\Settings\AiConnectionController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Middleware\EnsureOrganizationMembership;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])
        ->middleware(RequirePassword::class)
        ->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePassword::class)
        ->name('security.edit');

    Route::patch('settings/passkeys/{passkey}', [SecurityController::class, 'rename'])
        ->middleware(RequirePassword::class)
        ->name('passkeys.rename');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/ai-connections', [AiConnectionController::class, 'edit'])->name('ai-connections.edit');
    Route::delete('settings/ai-connections/{client}', [AiConnectionController::class, 'destroy'])->name('ai-connections.destroy');

    Route::get('settings/organizations', [OrganizationController::class, 'index'])->name('organizations.index');
    Route::post('settings/organizations', [OrganizationController::class, 'store'])->name('organizations.store');

    Route::middleware(EnsureOrganizationMembership::class)->group(function () {
        Route::get('settings/organizations/{organization}', [OrganizationController::class, 'edit'])->name('organizations.edit');
        Route::patch('settings/organizations/{organization}', [OrganizationController::class, 'update'])->name('organizations.update');
        Route::delete('settings/organizations/{organization}', [OrganizationController::class, 'destroy'])->name('organizations.destroy');
        Route::post('settings/organizations/{organization}/switch', [OrganizationController::class, 'switch'])->name('organizations.switch');
        Route::delete('settings/organizations/{organization}/leave', [OrganizationController::class, 'leave'])->name('organizations.leave');

        Route::patch('settings/organizations/{organization}/members/{user}', [OrganizationMemberController::class, 'update'])->name('organizations.members.update');
        Route::delete('settings/organizations/{organization}/members/{user}', [OrganizationMemberController::class, 'destroy'])->name('organizations.members.destroy');
        Route::patch('settings/organizations/{organization}/members/{user}/rate', [OrganizationMemberController::class, 'rate'])->name('organizations.members.rate');
        Route::post('settings/organizations/{organization}/members/{user}/deactivate', [OrganizationMemberController::class, 'deactivate'])->name('organizations.members.deactivate');
        Route::post('settings/organizations/{organization}/members/{user}/reactivate', [OrganizationMemberController::class, 'reactivate'])->name('organizations.members.reactivate');

        Route::post('settings/organizations/{organization}/invitations', [OrganizationInvitationController::class, 'store'])->name('organizations.invitations.store');
        Route::delete('settings/organizations/{organization}/invitations/{invitation}', [OrganizationInvitationController::class, 'destroy'])->name('organizations.invitations.destroy');
    });
});

Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
