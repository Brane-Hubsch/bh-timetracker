<?php

use App\Actions\Organizations\CreateOrganization;
use App\Actions\Settings\UpdateAppearance;
use App\Enums\Accent;
use App\Enums\ContrastPreference;
use App\Enums\OrganizationRole;
use App\Enums\Theme;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('requires sign-in to change the appearance', function () {
    $this->patch(route('appearance.update'), ['theme' => 'sand'])->assertRedirect(route('login'));
});

it('starts with the standard theme, the organization accent and device contrast', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/appearance')
            ->where('theme', [
                'theme' => 'standard',
                'accent' => 'violet',
                'ownAccent' => null,
                'organizationAccent' => 'violet',
                'contrast' => 'system',
            ]));
});

it('saves only the preferences that were sent', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->from(route('appearance.edit'))
        ->patch(route('appearance.update'), ['theme' => 'slate', 'accent' => 'teal'])
        ->assertRedirect(route('appearance.edit'));

    $this->patch(route('appearance.update'), ['contrast' => 'more'])->assertSessionHasNoErrors();

    $user->refresh();
    expect($user->theme)->toBe(Theme::Slate)
        ->and($user->accent)->toBe(Accent::Teal)
        ->and($user->contrast)->toBe(ContrastPreference::More);

    $this->patch(route('appearance.update'), ['accent' => null])->assertSessionHasNoErrors();

    expect($user->refresh()->accent)->toBeNull()
        ->and($user->theme)->toBe(Theme::Slate);
});

it('rejects unknown themes, accents and contrast values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('appearance.update'), ['theme' => 'neon', 'accent' => 'gold', 'contrast' => 'max'])
        ->assertSessionHasErrors(['theme', 'accent', 'contrast']);

    expect($user->refresh()->theme)->toBe(Theme::Standard);
});

it('uses the current organization accent unless the user picked their own', function () {
    $user = User::factory()->create();
    $createOrganization = app(CreateOrganization::class);
    $branded = $createOrganization->handle($user, 'Branded');
    $branded->update(['accent' => Accent::Green]);
    $plain = $createOrganization->handle($user, 'Plain');

    $this->actingAs($user)->get(route('time.index', $branded->slug))
        ->assertInertia(fn (Assert $page) => $page
            ->where('theme.accent', 'green')
            ->where('theme.organizationAccent', 'green')
            ->where('theme.ownAccent', null));

    $this->get(route('time.index', $plain->slug))
        ->assertInertia(fn (Assert $page) => $page->where('theme.accent', 'violet'));

    app(UpdateAppearance::class)->handle($user, ['accent' => Accent::Pink]);

    $this->actingAs($user->fresh())->get(route('time.index', $branded->slug))
        ->assertInertia(fn (Assert $page) => $page
            ->where('theme.accent', 'pink')
            ->where('theme.organizationAccent', 'green'));
});

it('renders the theme on the first page load', function () {
    $user = User::factory()->create();
    app(UpdateAppearance::class)->handle($user, ['theme' => Theme::Sand, 'accent' => Accent::Blue, 'contrast' => ContrastPreference::More]);

    $this->actingAs($user->fresh())->get(route('appearance.edit'))
        ->assertSee('data-palette="sand"', false)
        ->assertSee('data-accent="blue"', false)
        ->assertSee('data-contrast="more"', false);
});

it('lets owners and admins set the organization accent, but not members', function () {
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;
    $member = User::factory()->create();
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $settings = [
        'name' => $organization->name,
        'currency' => 'SEK',
        'week_starts_on' => 1,
        'timezone' => 'Europe/Stockholm',
    ];

    $this->actingAs($member)
        ->patch(route('organizations.update', $organization), [...$settings, 'accent' => 'orange'])
        ->assertForbidden();
    $this->actingAs(User::factory()->create())
        ->patch(route('organizations.update', $organization), [...$settings, 'accent' => 'orange'])
        ->assertForbidden();
    expect($organization->refresh()->accent)->toBeNull();

    $this->actingAs($owner)
        ->patch(route('organizations.update', $organization), [...$settings, 'accent' => 'orange'])
        ->assertSessionHasNoErrors();
    expect($organization->refresh()->accent)->toBe(Accent::Orange);

    $this->patch(route('organizations.update', $organization), [...$settings, 'accent' => 'gold'])
        ->assertSessionHasErrors('accent');

    $this->patch(route('organizations.update', $organization), [...$settings, 'accent' => null])
        ->assertSessionHasNoErrors();
    expect($organization->refresh()->accent)->toBeNull();
});
