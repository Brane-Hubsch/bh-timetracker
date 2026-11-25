<?php

use App\Enums\OrganizationRole;
use App\Models\Project;
use App\Models\RunningTimer;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // 10:30 in Stockholm.
    $this->travelTo(CarbonImmutable::parse('2026-11-25 09:30', 'UTC'));
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
    $this->member = User::factory()->withoutOrganization()->create(['current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->webbshop = Project::factory()->for($this->organization)->create(['name' => 'Webbshop']);
});

it('starts a timer from a local start time and shares it with every page', function () {
    $this->actingAs($this->member)
        ->post(route('timer.start', $this->slug), [
            'project_id' => $this->webbshop->id,
            'description' => 'Kodning',
            'tags' => ['Möte'],
            'date' => '2026-11-25',
            'start' => '10:00',
        ])
        ->assertSessionHasNoErrors();

    expect(RunningTimer::query()->sole()->started_at->utc()->format('H:i'))->toBe('09:00');

    $this->get(route('time.index', $this->slug))
        ->assertInertia(fn (Assert $page) => $page
            ->where('timer.project.name', 'Webbshop')
            ->where('timer.description', 'Kodning')
            ->where('timer.tags', ['Möte'])
            ->where('timer.start', '2026-11-25T10:00')
            ->where('timer.organization.slug', $this->slug)
            ->where('currentOrganization.timerEnabled', true));

    $this->actingAs($this->owner)->get(route('time.index', $this->slug))
        ->assertInertia(fn (Assert $page) => $page->where('timer', null));
});

it('starts without a project, which is chosen when stopping', function () {
    $this->actingAs($this->member)->post(route('timer.start', $this->slug))->assertSessionHasNoErrors();
    $this->travel(30)->minutes();

    $this->post(route('timer.stop', $this->slug))->assertSessionHasErrors('project_id');
    expect(RunningTimer::query()->count())->toBe(1);

    $this->post(route('timer.stop', $this->slug), [
        'project_id' => $this->webbshop->id,
        'description' => 'Kodning',
        'date' => '2026-11-25',
        'start' => '10:30',
    ])->assertSessionHasNoErrors();

    $entry = TimeEntry::query()->sole();
    expect($entry->project_id)->toBe($this->webbshop->id)
        ->and($entry->duration_seconds)->toBe(30 * 60)
        ->and(RunningTimer::query()->count())->toBe(0);
});

it('stops at a chosen local end time', function () {
    RunningTimer::factory()->by($this->member, $this->webbshop)->create(['started_at' => CarbonImmutable::parse('2026-11-24 15:00', 'UTC')]);

    $this->actingAs($this->member)->post(route('timer.stop', $this->slug), ['end_date' => '2026-11-24', 'end' => '18:00'])
        ->assertSessionHasNoErrors();

    expect(TimeEntry::query()->sole()->ended_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-24 17:00');
});

it('updates and discards the running timer', function () {
    $timer = RunningTimer::factory()->by($this->member, $this->webbshop)->create();

    $this->actingAs($this->member)->patch(route('timer.update', $this->slug), [
        'project_id' => $this->webbshop->id,
        'description' => 'Ny beskrivning',
        'date' => '2026-11-25',
        'start' => '09:45',
    ])->assertSessionHasNoErrors();
    expect($timer->fresh()->description)->toBe('Ny beskrivning');

    $this->delete(route('timer.discard', $this->slug))->assertRedirect();
    expect(RunningTimer::query()->count())->toBe(0)
        ->and(TimeEntry::query()->count())->toBe(0);

    $this->delete(route('timer.discard', $this->slug))->assertNotFound();
    $this->post(route('timer.stop', $this->slug))->assertNotFound();
});

it('refuses to start when the organization turned the timer off', function () {
    $this->organization->update(['timer_enabled' => false]);

    $this->actingAs($this->member)->post(route('timer.start', $this->slug))->assertSessionHasErrors('timer');
    $this->get(route('time.index', $this->slug))
        ->assertInertia(fn (Assert $page) => $page->where('currentOrganization.timerEnabled', false));
});

it('rejects projects of other organizations', function () {
    $foreign = Project::factory()->create();

    $this->actingAs($this->member)->post(route('timer.start', $this->slug), ['project_id' => $foreign->id])
        ->assertSessionHasErrors('project_id');
    expect(RunningTimer::query()->count())->toBe(0);
});
