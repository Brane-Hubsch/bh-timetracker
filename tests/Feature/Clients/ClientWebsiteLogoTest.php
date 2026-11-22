<?php

use App\Actions\Clients\FindClientWebsiteLogo;
use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\User;
use App\Services\Images\PublicWebsite;
use GuzzleHttp\Psr7\Uri;
use Illuminate\Http\UploadedFile;
use Psr\Http\Message\UriInterface;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->endpoint = route('clients.website-logo', ['current_organization' => $this->organization->slug]);
});

it('finds an Apple Touch icon relative to the redirected page without creating a client', function () {
    $apple = UploadedFile::fake()->image('touch.png', 180, 180)->get();

    $this->mock(PublicWebsite::class)->shouldReceive('get')->twice()
        ->andReturnUsing(fn (UriInterface $url) => match ((string) $url) {
            'https://example.com' => [
                'url' => new Uri('https://www.example.com/welcome/start'),
                'body' => '<link rel="apple-touch-icon" href="touch.png" sizes="180x180"><link rel="icon" href="/favicon.png">',
            ],
            'https://www.example.com/welcome/touch.png' => ['url' => $url, 'body' => $apple],
        });

    $this->actingAs($this->owner)->postJson($this->endpoint, ['website' => 'example.com'])
        ->assertOk()->assertJsonPath('logo.source', 'apple-touch')->assertJsonPath('logo.mime', 'image/png')
        ->assertJsonPath('logo.image', base64_encode($apple));

    expect(Client::forOrganization($this->organization)->exists())->toBeFalse();
});

it('chooses the larger favicon when the declared Apple Touch icon is too small', function () {
    $small = UploadedFile::fake()->image('small.png', 16, 16)->get();
    $large = UploadedFile::fake()->image('large.png', 96, 96)->get();

    $this->mock(PublicWebsite::class)->shouldReceive('get')->andReturnUsing(function (UriInterface $url) use ($small, $large) {
        $body = match ($url->getPath()) {
            '' => '<link rel="apple-touch-icon" href="/small.png" sizes="180x180"><link rel="shortcut icon" href="/large.png">',
            '/small.png' => $small,
            '/large.png' => $large,
            default => null,
        };

        return $body === null ? null : ['url' => $url, 'body' => $body];
    });

    expect(app(FindClientWebsiteLogo::class)->handle('https://example.com'))->toBe([
        'image' => base64_encode($large), 'mime' => 'image/png', 'source' => 'favicon',
    ]);
});

it('tries the conventional favicon when declared images are unavailable or unsuitable', function () {
    $ico = file_get_contents(public_path('favicon.ico'));

    $this->mock(PublicWebsite::class)->shouldReceive('get')->andReturnUsing(function (UriInterface $url) use ($ico) {
        $body = match ($url->getPath()) {
            '' => '<link rel="icon" href="/missing.png"><link rel="icon" href="/forbidden.svg" type="image/svg+xml">',
            '/missing.png' => '<html>This is an error page.</html>',
            '/favicon.ico' => $ico,
            '/apple-touch-icon.png' => null,
        };

        return $body === null ? null : ['url' => $url, 'body' => $body];
    });

    expect(app(FindClientWebsiteLogo::class)->handle('https://example.com'))->toBe([
        'image' => base64_encode($ico), 'mime' => 'image/x-icon', 'source' => 'favicon',
    ]);
});

it('returns an empty result when the site has no suitable image', function () {
    $this->mock(PublicWebsite::class)->shouldReceive('get')->andReturnNull();

    $this->actingAs($this->owner)->postJson($this->endpoint, ['website' => 'example.com'])
        ->assertOk()->assertExactJson(['logo' => null]);
});

it('rejects invalid website addresses before requesting anything', function () {
    $this->mock(PublicWebsite::class)->shouldNotReceive('get');

    $this->actingAs($this->owner)->postJson($this->endpoint, ['website' => 'javascript:alert(1)'])
        ->assertUnprocessable()->assertJsonValidationErrors('website');
});

it('allows only client managers in the current organization to fetch a logo', function () {
    $this->mock(PublicWebsite::class)->shouldNotReceive('get');
    $member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $this->actingAs($member)->postJson($this->endpoint, ['website' => 'example.com'])->assertForbidden();
    $this->actingAs(User::factory()->create())->postJson($this->endpoint, ['website' => 'example.com'])->assertForbidden();
});
