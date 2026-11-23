<?php

use App\Enums\AbsenceType;
use App\Enums\OrganizationRole;
use App\Models\Absence;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo('2026-11-24 10:00');
    $this->owner = User::factory()->create(['name' => 'Olivia']);
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Anna', 'current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->payload = fn (array $overrides = []) => [
        'type' => 'vacation',
        'starts_on' => '2026-11-23',
        'ends_on' => '2026-11-25',
        ...$overrides,
    ];
});

it('lets members register their own absence, full days or hours per day', function () {
    $this->actingAs($this->member)
        ->post(route('absences.store', $this->slug), ($this->payload)())
        ->assertSessionHasNoErrors();
    $this->post(route('absences.store', $this->slug), ($this->payload)(['type' => 'child_care', 'starts_on' => '2026-11-27', 'ends_on' => '2026-11-27', 'hours_per_day' => '4,5']))
        ->assertSessionHasNoErrors();

    $absences = Absence::query()->forOrganization($this->organization)->orderBy('starts_on')->get();
    expect($absences)->toHaveCount(2)
        ->and($absences[0]->user_id)->toBe($this->member->id)
        ->and($absences[0]->seconds_per_day)->toBeNull()
        ->and($absences[1]->type)->toBe(AbsenceType::ChildCare)
        ->and($absences[1]->seconds_per_day)->toBe((int) (4.5 * 3600));

    $this->post(route('absences.store', $this->slug), ($this->payload)(['starts_on' => '2026-11-30', 'ends_on' => '2026-11-30', 'hours_per_day' => 'mycket']))
        ->assertSessionHasErrors('hours_per_day');
    $this->post(route('absences.store', $this->slug), ($this->payload)(['type' => 'party']))
        ->assertSessionHasErrors('type');
});

it('lets owners register absence for members, but not members for others', function () {
    $this->actingAs($this->owner)
        ->post(route('absences.store', $this->slug), ($this->payload)(['user_id' => $this->member->id]))
        ->assertSessionHasNoErrors();

    $this->actingAs($this->member)
        ->post(route('absences.store', $this->slug), ($this->payload)(['user_id' => $this->owner->id, 'starts_on' => '2026-12-01', 'ends_on' => '2026-12-01']))
        ->assertForbidden();

    expect(Absence::query()->forOrganization($this->organization)->sole()->user_id)->toBe($this->member->id);
});

it('updates and deletes absence for those allowed', function () {
    $own = Absence::factory()->by($this->member, $this->organization)->create();
    $owners = Absence::factory()->by($this->owner, $this->organization)->create();

    $this->actingAs($this->member)
        ->patch(route('absences.update', [$this->slug, $own]), ($this->payload)(['type' => 'sick', 'ends_on' => '2026-11-26']))
        ->assertSessionHasNoErrors();
    expect($own->fresh()->type)->toBe(AbsenceType::Sick);

    $this->delete(route('absences.destroy', [$this->slug, $owners]))->assertForbidden();
    $this->delete(route('absences.destroy', [$this->slug, $own]))->assertRedirect();
    expect($own->fresh())->toBeNull()
        ->and($owners->fresh())->not->toBeNull();
});

it('does not reach another organization\'s absence', function () {
    $outsider = User::factory()->create();
    $foreign = Absence::factory()->by($outsider, $outsider->currentOrganization)->create();

    $this->actingAs($this->owner)->delete(route('absences.destroy', [$this->slug, $foreign]))->assertNotFound();
    $this->patch(route('absences.update', [$this->slug, $foreign]), ($this->payload)())->assertNotFound();

    expect($foreign->fresh())->not->toBeNull();
});

it('shows the member\'s absence in the calendar, and colleagues only as off', function () {
    Absence::factory()->by($this->member, $this->organization)->create(['type' => AbsenceType::Sick, 'note' => 'Influensa']);
    Absence::factory()->by($this->owner, $this->organization)->create(['type' => AbsenceType::ParentalLeave, 'starts_on' => '2026-11-26', 'ends_on' => '2026-11-27', 'note' => 'Privat']);
    // Another week and a deactivated colleague don't show.
    Absence::factory()->by($this->owner, $this->organization)->create(['starts_on' => '2026-12-07', 'ends_on' => '2026-12-08']);
    $gone = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($gone, ['role' => OrganizationRole::Member->value, 'deactivated_at' => now()]);
    Absence::factory()->by($gone, $this->organization)->create();

    $this->actingAs($this->member)->get(route('time.index', [$this->slug, 'date' => '2026-11-24']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('absences', 1)
            ->where('absences.0.type', 'sick')
            ->where('absences.0.note', 'Influensa')
            ->where('colleaguesOff', [['id' => Absence::query()->where('note', 'Privat')->value('id'), 'name' => 'Olivia', 'startsOn' => '2026-11-26', 'endsOn' => '2026-11-27']])
            ->where('workdaySeconds', 28800)
            ->has('absenceTypes', 6));

    // Owners see a member's absence in full on the member's calendar.
    $this->actingAs($this->owner)->get(route('time.index', [$this->slug, 'date' => '2026-11-24', 'user' => $this->member->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('absences.0.type', 'sick')
            ->where('colleaguesOff.0.name', 'Olivia'));
});
