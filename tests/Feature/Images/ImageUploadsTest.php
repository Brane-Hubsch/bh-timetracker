<?php

use App\Actions\Auth\DeleteAccount;
use App\Enums\OrganizationRole;
use App\Enums\ReportGrouping;
use App\Models\Client;
use App\Models\User;
use App\Services\Reports\ReportExporter;
use App\Services\Reports\ReportFilters;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');

    $this->owner = User::factory()->create(['avatar_url' => 'https://lh3.googleusercontent.com/me.jpg']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['current_organization_id' => $this->organization->id]);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);

    $this->outsider = User::factory()->create();
    $this->otherOrganization = $this->outsider->currentOrganization;
});

function photo(string $name = 'photo.jpg'): UploadedFile
{
    return UploadedFile::fake()->image($name, 400, 300);
}

describe('profile pictures', function () {
    it('uploads, replaces and removes the profile picture', function () {
        $this->actingAs($this->owner)
            ->post(route('profile.avatar.update'), ['image' => photo()])
            ->assertRedirect(route('profile.edit'));

        $first = $this->owner->fresh()->avatar_path;
        expect($first)->toStartWith('images/avatars/');
        Storage::disk('public')->assertExists("{$first}/128.webp");

        $this->post(route('profile.avatar.update'), ['image' => photo('new.png')]);
        $second = $this->owner->fresh()->avatar_path;
        expect($second)->not->toBe($first);
        Storage::disk('public')->assertMissing("{$first}/128.webp");

        $this->delete(route('profile.avatar.destroy'))->assertRedirect(route('profile.edit'));
        expect($this->owner->fresh()->avatar_path)->toBeNull();
        Storage::disk('public')->assertMissing("{$second}/128.webp");
    });

    it('shows the uploaded picture before the Google one', function () {
        expect($this->owner->avatar)->toBe('https://lh3.googleusercontent.com/me.jpg');

        $this->actingAs($this->owner)->post(route('profile.avatar.update'), ['image' => photo()]);

        $this->get(route('profile.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.avatar', fn (string $url) => str_contains($url, '/images/avatars/') && str_ends_with($url, '/128.webp'))
            ->where('avatar.uploaded', fn (string $url) => str_ends_with($url, '/256.webp'))
            ->where('avatar.fallback', 'https://lh3.googleusercontent.com/me.jpg')
            ->missing('auth.user.avatar_path'));
    });

    it('rejects files that are not raster images or are too large', function (UploadedFile $file) {
        $this->actingAs($this->owner)
            ->post(route('profile.avatar.update'), ['image' => $file])
            ->assertSessionHasErrors('image');

        expect($this->owner->fresh()->avatar_path)->toBeNull();
    })->with([
        'svg' => fn () => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        'pdf' => fn () => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf'),
        'too large' => fn () => UploadedFile::fake()->image('big.jpg', 400, 300)->size(6000),
        'too many pixels' => fn () => UploadedFile::fake()->image('huge.png', 7000, 10),
    ]);

    it('deletes the picture with the account', function () {
        $this->actingAs($this->member)->post(route('profile.avatar.update'), ['image' => photo()]);
        $path = $this->member->fresh()->avatar_path;

        app(DeleteAccount::class)->handle($this->member->fresh());

        Storage::disk('public')->assertMissing("{$path}/128.webp");
    });
});

describe('organization logos', function () {
    it('lets owners and admins upload and remove the logo', function () {
        $this->actingAs($this->owner)
            ->post(route('organizations.logo.update', $this->organization->slug), ['image' => photo('logo.png')])
            ->assertRedirect(route('organizations.edit', $this->organization->slug));

        $path = $this->organization->fresh()->logo_path;
        expect($path)->toStartWith('images/logos/');
        $image = getimagesizefromstring((string) Storage::disk('public')->get("{$path}/256.webp"));
        expect([$image[0], $image[1]])->toBe([256, 256]);

        // Shown in the organization switcher for every member.
        $this->actingAs($this->member)->get(route('organizations.edit', $this->organization->slug))
            ->assertInertia(fn (Assert $page) => $page
                ->where('currentOrganization.logo', fn (string $url) => str_ends_with($url, "{$path}/128.webp"))
                ->where('organization.logo', fn (string $url) => str_ends_with($url, "{$path}/256.webp")));

        $this->actingAs($this->owner)->delete(route('organizations.logo.destroy', $this->organization->slug));
        expect($this->organization->fresh()->logo_path)->toBeNull();
        Storage::disk('public')->assertMissing("{$path}/128.webp");
    });

    it('refuses members and other organizations', function () {
        $this->actingAs($this->member)
            ->post(route('organizations.logo.update', $this->organization->slug), ['image' => photo()])
            ->assertForbidden();
        $this->actingAs($this->outsider)
            ->post(route('organizations.logo.update', $this->organization->slug), ['image' => photo()])
            ->assertForbidden();
        $this->actingAs($this->outsider)
            ->delete(route('organizations.logo.destroy', $this->organization->slug))
            ->assertForbidden();

        expect($this->organization->fresh()->logo_path)->toBeNull();
    });
});

describe('client logos', function () {
    it('creates a client with a logo and shows it in the list', function () {
        $this->actingAs($this->owner)
            ->post(route('clients.store', $this->organization->slug), ['name' => 'Nordic', 'logo' => photo('logo.png')])
            ->assertRedirect();

        $client = Client::query()->where('name', 'Nordic')->sole();
        expect($client->logo_path)->toStartWith('images/logos/');

        $this->get(route('clients.index', $this->organization->slug))
            ->assertInertia(fn (Assert $page) => $page->where('clients.1.logo', fn (string $url) => str_ends_with($url, '/128.webp')));
    });

    it('replaces, keeps or removes the logo when the client is saved', function () {
        $this->actingAs($this->owner);
        $update = fn (array $data) => $this->post(route('clients.update', [$this->organization->slug, $this->client->id]), [
            '_method' => 'PATCH',
            'name' => 'Acme',
            ...$data,
        ]);

        $update(['logo' => photo('logo.png')])->assertRedirect();
        $first = $this->client->fresh()->logo_path;

        $update([])->assertRedirect();
        expect($this->client->fresh()->logo_path)->toBe($first);

        $update(['remove_logo' => '1'])->assertRedirect();
        expect($this->client->fresh()->logo_path)->toBeNull();
        Storage::disk('public')->assertMissing("{$first}/128.webp");
    });

    it('refuses members and other organizations\' clients', function () {
        $foreign = Client::factory()->for($this->otherOrganization)->create();

        $this->actingAs($this->member)
            ->post(route('clients.update', [$this->organization->slug, $this->client->id]), ['_method' => 'PATCH', 'name' => 'Acme', 'logo' => photo()])
            ->assertForbidden();
        $this->actingAs($this->owner)
            ->post(route('clients.update', [$this->organization->slug, $foreign->id]), ['_method' => 'PATCH', 'name' => 'Stulen', 'logo' => photo()])
            ->assertNotFound();

        expect($this->client->fresh()->logo_path)->toBeNull()
            ->and($foreign->fresh()->logo_path)->toBeNull();
    });
});

it('puts the organization logo, and a single client\'s logo, on PDF reports', function () {
    $this->actingAs($this->owner)->post(route('organizations.logo.update', $this->organization->slug), ['image' => photo('logo.png')]);
    $this->post(route('clients.update', [$this->organization->slug, $this->client->id]), ['_method' => 'PATCH', 'name' => 'Acme', 'logo' => photo('acme.png')]);

    $filters = fn (array $clientIds) => new ReportFilters(
        organization: $this->organization->fresh(),
        viewer: $this->owner,
        from: CarbonImmutable::parse('2026-11-01'),
        to: CarbonImmutable::parse('2026-11-30'),
        clientIds: $clientIds,
    );
    $exporter = app(ReportExporter::class);

    $all = $exporter->summaryDocument($filters([]), ReportGrouping::Client, null)->render();
    $single = $exporter->summaryDocument($filters([$this->client->id]), ReportGrouping::Client, null)->render();

    expect(substr_count($all, 'data:image/png;base64,'))->toBe(1)
        ->and(substr_count($single, 'data:image/png;base64,'))->toBe(2)
        ->and($single)->toContain('class="client-logo"');
});
