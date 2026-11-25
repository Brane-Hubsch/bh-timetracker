<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('requires sign-in to edit sidebar preferences', function () {
    $this->get(route('sidebar.edit'))->assertRedirect(route('login'));
});

it('shows the sidebar settings page for a verified user', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('sidebar.edit'))
        ->assertInertia(fn (Assert $page) => $page->component('settings/sidebar'));
});
