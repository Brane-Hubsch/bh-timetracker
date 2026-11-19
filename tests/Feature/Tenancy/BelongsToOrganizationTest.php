<?php

use App\Exceptions\MissingCurrentOrganizationException;
use App\Models\Concerns\BelongsToOrganization;
use App\Models\Organization;
use App\Support\CurrentOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Minimal tenant model used to test the trait until real tenant models (clients, projects) exist.
 */
class TenantThing extends Model
{
    use BelongsToOrganization;

    protected $table = 'tenant_things';

    protected $guarded = [];
}

beforeEach(function () {
    Schema::create('tenant_things', function (Blueprint $table) {
        $table->id();
        $table->foreignId('organization_id')->constrained();
        $table->string('name');
        $table->timestamps();
    });

    $this->organizationA = Organization::factory()->create();
    $this->organizationB = Organization::factory()->create();

    DB::table('tenant_things')->insert([
        ['organization_id' => $this->organizationA->id, 'name' => 'A1'],
        ['organization_id' => $this->organizationA->id, 'name' => 'A2'],
        ['organization_id' => $this->organizationB->id, 'name' => 'B1'],
    ]);
});

it('only returns rows from the active organization', function () {
    app(CurrentOrganization::class)->set($this->organizationA);

    expect(TenantThing::pluck('name')->sort()->values()->all())->toBe(['A1', 'A2']);

    app(CurrentOrganization::class)->set($this->organizationB);

    expect(TenantThing::pluck('name')->all())->toBe(['B1']);
});

it('cannot find another organization\'s row by id', function () {
    $foreignId = TenantThing::forOrganization($this->organizationB)->value('id');
    app(CurrentOrganization::class)->set($this->organizationA);

    expect(TenantThing::find($foreignId))->toBeNull();
});

it('assigns the active organization when creating', function () {
    app(CurrentOrganization::class)->set($this->organizationB);

    $thing = TenantThing::create(['name' => 'B2']);

    expect($thing->organization_id)->toBe($this->organizationB->id)
        ->and($thing->organization->is($this->organizationB))->toBeTrue();
});

it('refuses to create tenant data without an organization', function () {
    TenantThing::create(['name' => 'orphan']);
})->throws(MissingCurrentOrganizationException::class);

it('can scope explicitly to an organization regardless of the active one', function () {
    app(CurrentOrganization::class)->set($this->organizationA);

    expect(TenantThing::forOrganization($this->organizationB)->pluck('name')->all())->toBe(['B1'])
        ->and(TenantThing::forOrganization($this->organizationA->id)->count())->toBe(2);
});
