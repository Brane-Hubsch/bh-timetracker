<?php

use App\Actions\Organizations\CreateOrganization;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('requires sign-in to edit sidebar preferences', function () {
    $this->get(route('sidebar.edit'))->assertRedirect(route('login'));
});

it('shows the sidebar settings page for a verified user', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('sidebar.edit'))
        ->assertInertia(fn (Assert $page) => $page->component('settings/sidebar')->where('sidebarHiddenItems', null));
});

it('saves the sidebar visibility to the signed-in account', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $createOrganization = app(CreateOrganization::class);
    $first = $createOrganization->handle($user, 'First organization');
    $second = $createOrganization->handle($user, 'Second organization');

    $this->actingAs($user)->from(route('sidebar.edit'))
        ->patch(route('sidebar.visibility.update'), ['item' => 'Reports', 'visible' => false, 'user_id' => $other->id])
        ->assertRedirect(route('sidebar.edit'));

    $this->actingAs($user->fresh())->get(route('sidebar.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('currentOrganization.id', $second->id)
            ->where('sidebarHiddenItems', ['Reports']));

    $this->get(route('time.index', $first->slug))
        ->assertInertia(fn (Assert $page) => $page
            ->where('currentOrganization.id', $first->id)
            ->where('sidebarHiddenItems', ['Reports']));

    $this->actingAs($other)->get(route('sidebar.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('sidebarHiddenItems', null));
});

it('updates individual items and keeps existing account settings over browser data', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->from(route('sidebar.edit'));

    $this->patch(route('sidebar.visibility.update'), ['legacy_hidden_items' => ['Add', 'Reports']])
        ->assertRedirect(route('sidebar.edit'));

    $this->patch(route('sidebar.visibility.update'), [
        'item' => 'Reports',
        'visible' => true,
        'legacy_hidden_items' => ['Search'],
    ])->assertRedirect(route('sidebar.edit'));

    $this->patch(route('sidebar.visibility.update'), ['legacy_hidden_items' => ['Calendar']])
        ->assertRedirect(route('sidebar.edit'));

    expect($user->fresh()->sidebar_hidden_items)->toBe(['Add']);
});

it('uses browser settings as a starting point when the first update arrives before the import', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->from(route('sidebar.edit'))
        ->patch(route('sidebar.visibility.update'), [
            'item' => 'Add',
            'visible' => true,
            'legacy_hidden_items' => ['Add'],
        ])->assertRedirect(route('sidebar.edit'));

    $this->patch(route('sidebar.visibility.update'), ['legacy_hidden_items' => ['Add']])
        ->assertRedirect(route('sidebar.edit'));

    expect($user->fresh()->sidebar_hidden_items)->toBe([]);
});

it('accepts an explicit browser preference to show all items', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->from(route('sidebar.edit'))
        ->patch(route('sidebar.visibility.update'), ['legacy_hidden_items' => []])
        ->assertRedirect(route('sidebar.edit'));

    expect($user->fresh()->sidebar_hidden_items)->toBe([]);
});

it('requires a verified account to update sidebar visibility', function () {
    $url = route('sidebar.visibility.update');

    $this->patchJson($url, ['item' => 'Search', 'visible' => false])->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())
        ->patchJson($url, ['item' => 'Search', 'visible' => false])->assertForbidden();
});

it('validates the sidebar item and its visibility', function () {
    $this->actingAs(User::factory()->create())
        ->patchJson(route('sidebar.visibility.update'), [
            'item' => 'Profile',
            'legacy_hidden_items' => ['Profile'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['item', 'visible', 'legacy_hidden_items.0']);
});
