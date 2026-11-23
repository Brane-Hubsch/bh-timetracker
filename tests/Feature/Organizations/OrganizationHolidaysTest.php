<?php

use App\Actions\Organizations\CreateOrganization;
use App\Enums\OrganizationRole;
use App\Models\Holiday;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo('2026-11-23 10:00');
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->holidayRoute = fn (string $name, array $parameters = []) => route($name, ['organization' => $this->organization->slug, ...$parameters]);
});

it('starts new organizations with the Swedish holidays of this year and the next', function () {
    $organization = app(CreateOrganization::class)->handle($this->owner, 'Nytt AB');

    $dates = Holiday::query()->forOrganization($organization)->orderBy('date')->get()->map(fn (Holiday $holiday) => $holiday->date->toDateString());
    expect($dates)->toHaveCount(24)
        ->and($dates->first())->toBe('2026-01-01')
        ->and($dates->last())->toBe('2027-12-31');
});

it('lets owners add and delete holidays and fill in the Swedish ones for a year', function () {
    $this->actingAs($this->owner)
        ->post(($this->holidayRoute)('organizations.holidays.store'), ['date' => '2027-08-13', 'name' => 'Kick-off'])
        ->assertSessionHasNoErrors();
    $this->post(($this->holidayRoute)('organizations.holidays.store'), ['date' => '2027-08-13', 'name' => 'Igen'])
        ->assertSessionHasErrors('date');
    $this->post(($this->holidayRoute)('organizations.holidays.store'), ['date' => '13/08/2027', 'name' => 'Fel format'])
        ->assertSessionHasErrors('date');

    // Christmas Eve 2027 already has another name: it is kept.
    Holiday::factory()->for($this->organization)->create(['date' => '2027-12-24', 'name' => 'Stängt']);
    $this->post(($this->holidayRoute)('organizations.holidays.swedish'), ['year' => 2027])
        ->assertInertiaFlash('toast.message', trans_choice(':count holiday added.|:count holidays added.', 11, ['count' => 11]));
    expect(Holiday::query()->forOrganization($this->organization)->whereDate('date', '2027-12-24')->sole()->name)->toBe('Stängt');

    $kickoff = Holiday::query()->forOrganization($this->organization)->where('name', 'Kick-off')->sole();
    $this->delete(($this->holidayRoute)('organizations.holidays.destroy', ['holiday' => $kickoff->id]))->assertRedirect();
    expect(Holiday::query()->whereKey($kickoff->id)->exists())->toBeFalse();
});

it('shows the holidays from this year on to owners and admins only', function () {
    Holiday::factory()->for($this->organization)->create(['date' => '2025-12-24', 'name' => 'I fjol']);
    $holiday = Holiday::factory()->for($this->organization)->create(['date' => '2026-12-28', 'name' => 'Kick-off']);

    $this->actingAs($this->owner)->get(($this->holidayRoute)('organizations.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('holidays', [['id' => $holiday->id, 'date' => '2026-12-28', 'name' => 'Kick-off']])
            ->where('holidayYears', [2026, 2027, 2028]));

    $this->actingAs($this->member)->get(($this->holidayRoute)('organizations.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('holidays', null));
});

it('keeps members from changing holidays', function () {
    $holiday = Holiday::factory()->for($this->organization)->create();

    $this->actingAs($this->member)->post(($this->holidayRoute)('organizations.holidays.store'), ['date' => '2027-01-02', 'name' => 'Ledig'])->assertForbidden();
    $this->actingAs($this->member)->post(($this->holidayRoute)('organizations.holidays.swedish'), ['year' => 2027])->assertForbidden();
    $this->actingAs($this->member)->delete(($this->holidayRoute)('organizations.holidays.destroy', ['holiday' => $holiday->id]))->assertForbidden();

    expect(Holiday::query()->forOrganization($this->organization)->count())->toBe(1);
});

it('does not reach another organization\'s holidays', function () {
    $foreign = Holiday::factory()->create(['name' => 'Främmande']);

    $this->actingAs($this->owner)
        ->delete(($this->holidayRoute)('organizations.holidays.destroy', ['holiday' => $foreign->id]))
        ->assertNotFound();

    expect($foreign->fresh())->not->toBeNull();
});

it('says so when the Swedish holidays of a year are already there', function () {
    $this->actingAs($this->owner)->post(($this->holidayRoute)('organizations.holidays.swedish'), ['year' => 2027]);

    $this->post(($this->holidayRoute)('organizations.holidays.swedish'), ['year' => 2027])
        ->assertInertiaFlash('toast.message', __('All Swedish holidays of :year are already there.', ['year' => 2027]));
});
