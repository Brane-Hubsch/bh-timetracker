<?php

use App\Enums\AbsenceType;
use App\Enums\OrganizationRole;
use App\Mcp\Servers\TimetrackerServer;
use App\Mcp\Tools\CreateAbsenceTool;
use App\Mcp\Tools\DeleteAbsenceTool;
use App\Mcp\Tools\GetContextTool;
use App\Mcp\Tools\GetReportTool;
use App\Mcp\Tools\ListAbsencesTool;
use App\Mcp\Tools\UpdateAbsenceTool;
use App\Models\Absence;
use App\Models\Holiday;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    // Wednesday 18 November 2026.
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member', 'current_organization_id' => $this->organization->id]);
    $this->colleague = User::factory()->withoutOrganization()->create(['name' => 'Cole Colleague']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->organization->members()->attach($this->colleague, ['role' => OrganizationRole::Member->value]);
    Holiday::factory()->for($this->organization)->create(['date' => '2026-12-24 00:00:00']);
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('tells the workday length and absence types in the context', function () {
    TimetrackerServer::actingAs($this->member)
        ->tool(GetContextTool::class)
        ->assertOk()
        ->assertStructuredContentPaths([
            'organization.workday_hours' => 8,
            'absence_types' => ['vacation', 'child_care', 'sick', 'parental_leave', 'leave_of_absence', 'other'],
        ]);
});

it('registers the user\'s own absence, full days or hours per day', function () {
    TimetrackerServer::actingAs($this->member)
        ->tool(CreateAbsenceTool::class, ['type' => 'vacation', 'starts_on' => '2026-12-21', 'ends_on' => '2026-12-24', 'note' => 'Jul'])
        ->assertOk()
        ->assertStructuredContentPath('created', [
            'id' => Absence::query()->forOrganization($this->organization)->value('id'),
            'member' => ['id' => $this->member->id, 'name' => 'Mia Member'],
            'type' => 'vacation',
            'starts_on' => '2026-12-21',
            'ends_on' => '2026-12-24',
            'full_days' => true,
            // Christmas Eve is a holiday.
            'working_days' => 3,
            'hours' => 24,
            'note' => 'Jul',
        ]);

    TimetrackerServer::actingAs($this->member)
        ->tool(CreateAbsenceTool::class, ['type' => 'child_care', 'starts_on' => '2026-11-19', 'hours_per_day' => '4,5'])
        ->assertOk()
        ->assertStructuredContentPaths(['created.ends_on' => '2026-11-19', 'created.hours_per_day' => 4.5, 'created.hours' => 4.5]);

    expect(Absence::query()->forOrganization($this->organization)->where('user_id', $this->member->id)->count())->toBe(2);
});

it('rejects invalid absence', function (array $arguments, string $error) {
    Absence::factory()->by($this->member, $this->organization)->create(['starts_on' => '2026-11-23', 'ends_on' => '2026-11-25']);

    TimetrackerServer::actingAs($this->member)
        ->tool(CreateAbsenceTool::class, ['type' => 'vacation', ...$arguments])
        ->assertHasErrors([$error]);
})->with([
    // The shared absence rules answer in the app's language (Swedish by default).
    'overlap' => [['starts_on' => '2026-11-25', 'ends_on' => '2026-11-26'], 'har redan frånvaro'],
    'weekend' => [['starts_on' => '2026-11-21', 'ends_on' => '2026-11-22'], 'inga arbetsdagar'],
    'hours' => [['starts_on' => '2026-11-30', 'hours_per_day' => 'lite'], 'hours per day'],
    'other member' => [['starts_on' => '2026-11-30', 'member' => 'Cole Colleague'], 'Only owners and admins'],
]);

it('lets owners register absence for members', function () {
    TimetrackerServer::actingAs($this->owner)
        ->tool(CreateAbsenceTool::class, ['type' => 'sick', 'starts_on' => '2026-11-18', 'member' => 'Mia Member'])
        ->assertOk()
        ->assertStructuredContentPath('created.member.name', 'Mia Member');
});

it('lists the user\'s absence, and colleagues only as off for members', function () {
    $own = Absence::factory()->by($this->member, $this->organization)->create(['type' => AbsenceType::Sick, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-17', 'note' => 'Förkyld']);
    Absence::factory()->by($this->colleague, $this->organization)->create(['type' => AbsenceType::ParentalLeave, 'starts_on' => '2026-11-26', 'ends_on' => '2026-11-27', 'note' => 'Privat']);
    Absence::factory()->by($this->colleague, $this->organization)->create(['starts_on' => '2027-02-01', 'ends_on' => '2027-02-05']);

    TimetrackerServer::actingAs($this->member)
        ->tool(ListAbsencesTool::class)
        ->assertOk()
        ->assertStructuredContentPaths([
            'period' => ['from' => '2026-11-01', 'to' => '2026-11-30'],
            'absences' => [[
                'id' => $own->id,
                'member' => ['id' => $this->member->id, 'name' => 'Mia Member'],
                'type' => 'sick',
                'starts_on' => '2026-11-16',
                'ends_on' => '2026-11-17',
                'full_days' => true,
                'working_days' => 2,
                'hours' => 16,
                'note' => 'Förkyld',
            ]],
        ]);

    TimetrackerServer::actingAs($this->member)
        ->tool(ListAbsencesTool::class, ['member' => 'all'])
        ->assertOk()
        ->assertStructuredContentPath('absences.1', [
            'member' => ['id' => $this->colleague->id, 'name' => 'Cole Colleague'],
            'off' => true,
            'starts_on' => '2026-11-26',
            'ends_on' => '2026-11-27',
        ])
        ->assertDontSee('Privat')
        ->assertDontSee('parental_leave');

    TimetrackerServer::actingAs($this->member)
        ->tool(ListAbsencesTool::class, ['member' => 'Cole Colleague'])
        ->assertHasErrors(['Only owners and admins']);

    TimetrackerServer::actingAs($this->owner)
        ->tool(ListAbsencesTool::class, ['member' => 'all', 'type' => 'parental_leave'])
        ->assertOk()
        ->assertStructuredContentPaths(['absences.0.type' => 'parental_leave', 'absences.0.note' => 'Privat']);
});

it('changes only the given fields of an absence', function () {
    $absence = Absence::factory()->by($this->member, $this->organization)->create(['starts_on' => '2026-11-23', 'ends_on' => '2026-11-25', 'seconds_per_day' => 4 * 3600, 'note' => 'Halvdagar']);

    TimetrackerServer::actingAs($this->member)
        ->tool(UpdateAbsenceTool::class, ['id' => $absence->id, 'ends_on' => '2026-11-27', 'hours_per_day' => null])
        ->assertOk()
        ->assertStructuredContentPaths([
            'updated.starts_on' => '2026-11-23',
            'updated.ends_on' => '2026-11-27',
            'updated.full_days' => true,
            'updated.working_days' => 5,
            'updated.note' => 'Halvdagar',
        ]);

    TimetrackerServer::actingAs($this->member)
        ->tool(UpdateAbsenceTool::class, ['id' => $absence->id, 'type' => 'child_care', 'note' => null])
        ->assertOk();

    expect($absence->fresh())->type->toBe(AbsenceType::ChildCare)->note->toBeNull()->seconds_per_day->toBeNull();
});

it('deletes absence for those allowed, never another organization\'s', function () {
    $own = Absence::factory()->by($this->member, $this->organization)->create();
    $colleagues = Absence::factory()->by($this->colleague, $this->organization)->create();
    $outsider = User::factory()->create();
    $foreign = Absence::factory()->by($outsider, $outsider->currentOrganization)->create();

    TimetrackerServer::actingAs($this->member)->tool(DeleteAbsenceTool::class, ['id' => $colleagues->id])->assertHasErrors();
    TimetrackerServer::actingAs($this->member)->tool(UpdateAbsenceTool::class, ['id' => $colleagues->id, 'note' => 'x'])->assertHasErrors();
    TimetrackerServer::actingAs($this->owner)->tool(DeleteAbsenceTool::class, ['id' => $foreign->id])->assertHasErrors(['No absence with id '.$foreign->id]);
    TimetrackerServer::actingAs($this->owner)->tool(UpdateAbsenceTool::class, ['id' => $foreign->id, 'note' => 'x'])->assertHasErrors(['No absence with id '.$foreign->id]);

    TimetrackerServer::actingAs($this->member)
        ->tool(DeleteAbsenceTool::class, ['id' => $own->id])
        ->assertOk()
        ->assertStructuredContentPath('deleted.id', $own->id);

    expect($own->fresh())->toBeNull()
        ->and($colleagues->fresh())->not->toBeNull()
        ->and($foreign->fresh())->not->toBeNull();
});

it('includes absence days per member and type in the report', function () {
    Absence::factory()->by($this->member, $this->organization)->create(['starts_on' => '2026-11-23', 'ends_on' => '2026-11-25']);
    Absence::factory()->by($this->member, $this->organization)->create(['type' => AbsenceType::ChildCare, 'starts_on' => '2026-11-26', 'ends_on' => '2026-11-26', 'seconds_per_day' => 4 * 3600]);
    Absence::factory()->by($this->colleague, $this->organization)->create(['type' => AbsenceType::Sick, 'starts_on' => '2026-11-02', 'ends_on' => '2026-11-02']);

    TimetrackerServer::actingAs($this->member)
        ->tool(GetReportTool::class, ['period' => 'this_month'])
        ->assertOk()
        ->assertStructuredContentPath('absence', [[
            'member' => 'Mia Member',
            'days' => 3.5,
            'hours' => 28,
            'days_by_type' => ['vacation' => 3, 'child_care' => 0.5],
        ]]);

    TimetrackerServer::actingAs($this->owner)
        ->tool(GetReportTool::class, ['period' => 'this_month'])
        ->assertOk()
        ->assertStructuredContentPath('absence.0.member', 'Cole Colleague');
});
