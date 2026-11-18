<?php

use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Auth\InvitationController;
use App\Http\Controllers\Auth\MagicLinkController;
use App\Http\Controllers\Auth\PasskeySetupController;
use App\Http\Controllers\Auth\RegisterController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Passwordless sign-in
|--------------------------------------------------------------------------
|
| Fortify provides the login page, passkey login/management, logout, access
| confirmation and email verification. These routes add magic links, Google,
| self-registration (when enabled) and the invitation landing page.
|
*/

Route::middleware('guest')->group(function () {
    Route::post('login/link', [MagicLinkController::class, 'store'])
        ->middleware('throttle:magic-link')
        ->name('magic-link.store');

    Route::get('register', [RegisterController::class, 'create'])->name('register');
    Route::post('register', [RegisterController::class, 'store'])
        ->middleware('throttle:magic-link')
        ->name('register.store');

    Route::get('auth/google/redirect', [GoogleController::class, 'redirect'])->name('google.redirect');
    Route::get('auth/google/callback', [GoogleController::class, 'callback'])->name('google.callback');

    Route::post('invitations/{invitation}/account', [InvitationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('invitations.account.store');
});

// Opening the link does not use it; the POST does (email scanners only GET).
Route::get('login/link/{token}', [MagicLinkController::class, 'show'])->name('magic-link.show');
Route::post('login/link/{token}', [MagicLinkController::class, 'consume'])
    ->middleware('throttle:10,1')
    ->name('magic-link.consume');

// Requesting a link to confirm access (users without passkeys) while signed in.
Route::post('confirm/link', [MagicLinkController::class, 'confirm'])
    ->middleware(['auth', 'throttle:magic-link'])
    ->name('magic-link.confirm');

Route::get('invitations/{invitation}', [InvitationController::class, 'show'])->name('invitations.show');

Route::get('welcome/passkey', PasskeySetupController::class)
    ->middleware(['auth', 'verified'])
    ->name('passkey-setup');
