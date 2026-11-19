<?php

use App\Models\User;

it('sends guests to the login page', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

it('sends members to their current organization\'s dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('dashboard', ['current_organization' => $user->currentOrganization->slug], absolute: false));
});

it('sends users without an organization to onboarding', function () {
    $user = User::factory()->withoutOrganization()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('onboarding', absolute: false));
});
