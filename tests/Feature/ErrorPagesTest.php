<?php

use App\Models\User;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['app.debug' => false]);
});

it('renders friendly error pages', function (int $status) {
    Route::middleware('web')->get('/_test/error', fn () => abort($status));

    $this->actingAs(User::factory()->create())
        ->get('/_test/error')
        ->assertStatus($status)
        ->assertInertia(fn (Assert $page) => $page
            ->component('error')
            ->where('status', $status)
            ->has('locale'));
})->with([403, 404, 429, 500, 503]);

it('renders the error page for unknown URLs, also for guests', function () {
    $this->get('/does-not-exist')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 404));
});

it('keeps JSON errors for API and MCP clients', function () {
    $this->getJson('/does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});

it('shows Laravel\'s debug page in debug mode', function () {
    config(['app.debug' => true]);

    $this->get('/does-not-exist')->assertNotFound()->assertDontSee('"component":"error"', false);
});

it('sends the user back with a toast when the session expired', function () {
    // CSRF checks are skipped in tests, so throw what VerifyCsrfToken throws for an expired session.
    Route::middleware('web')->post('/_test/form', fn () => throw new TokenMismatchException);

    $this->from('/settings/profile')
        ->post('/_test/form')
        ->assertRedirect('/settings/profile')
        ->assertInertiaFlash('toast.type', 'warning');
});
