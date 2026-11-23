<?php

use App\Http\Controllers\Absences\AbsenceController;
use App\Http\Controllers\Clients\ClientController;
use App\Http\Controllers\Clients\ClientWebsiteLogoController;
use App\Http\Controllers\CommandPaletteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\Organizations\OrganizationInvitationController;
use App\Http\Controllers\Projects\ProjectController;
use App\Http\Controllers\Projects\ProjectMemberController;
use App\Http\Controllers\Reports\ReportController;
use App\Http\Controllers\Tags\TagController;
use App\Http\Controllers\TimeEntries\TimeEntryController;
use App\Http\Middleware\EnsureOrganizationMembership;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

require __DIR__.'/auth.php';

Route::prefix('{current_organization}')
    ->middleware(['auth', 'verified', EnsureOrganizationMembership::class])
    ->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');

        Route::get('time', [TimeEntryController::class, 'index'])->name('time.index');
        Route::post('time', [TimeEntryController::class, 'store'])->name('time.store');
        Route::post('time/copy', [TimeEntryController::class, 'copy'])->name('time.copy');
        Route::patch('time/{timeEntry}', [TimeEntryController::class, 'update'])->name('time.update');
        Route::delete('time/{timeEntry}', [TimeEntryController::class, 'destroy'])->name('time.destroy');
        Route::post('time/{timeEntry}/restore', [TimeEntryController::class, 'restore'])->withTrashed()->name('time.restore');

        Route::post('absences', [AbsenceController::class, 'store'])->name('absences.store');
        Route::patch('absences/{absence}', [AbsenceController::class, 'update'])->name('absences.update');
        Route::delete('absences/{absence}', [AbsenceController::class, 'destroy'])->name('absences.destroy');

        Route::get('command-palette', CommandPaletteController::class)->name('command-palette');

        Route::get('reports', [ReportController::class, 'summary'])->name('reports.summary');
        Route::get('reports/detailed', [ReportController::class, 'detailed'])->name('reports.detailed');
        Route::get('reports/projects', [ReportController::class, 'projects'])->name('reports.projects');
        Route::get('reports/export', [ReportController::class, 'export'])->name('reports.export');

        Route::get('tags', [TagController::class, 'index'])->name('tags.index');
        Route::post('tags', [TagController::class, 'store'])->name('tags.store');
        Route::patch('tags/{tag}', [TagController::class, 'update'])->name('tags.update');
        Route::delete('tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');

        Route::get('clients', [ClientController::class, 'index'])->name('clients.index');
        Route::post('clients', [ClientController::class, 'store'])->name('clients.store');
        Route::post('clients/website-logo', ClientWebsiteLogoController::class)->middleware('throttle:10,1')->name('clients.website-logo');
        Route::get('clients/{client}', [ClientController::class, 'show'])->name('clients.show');
        Route::patch('clients/{client}', [ClientController::class, 'update'])->name('clients.update');
        Route::post('clients/{client}/archive', [ClientController::class, 'archive'])->name('clients.archive');
        Route::post('clients/{client}/restore', [ClientController::class, 'restore'])->name('clients.restore');

        Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
        Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
        Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
        Route::patch('projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
        Route::post('projects/{project}/archive', [ProjectController::class, 'archive'])->name('projects.archive');
        Route::post('projects/{project}/restore', [ProjectController::class, 'restore'])->name('projects.restore');

        Route::post('projects/{project}/members', [ProjectMemberController::class, 'store'])->name('projects.members.store');
        Route::patch('projects/{project}/members/{user}', [ProjectMemberController::class, 'update'])->name('projects.members.update');
        Route::delete('projects/{project}/members/{user}', [ProjectMemberController::class, 'destroy'])->name('projects.members.destroy');
    });

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
    Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
});

Route::middleware(['auth'])->group(function () {
    Route::post('invitations/{invitation}/accept', [OrganizationInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [OrganizationInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
