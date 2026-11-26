<?php

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Vite;

it('sends Swedish, branded sign-in emails', function () {
    $user = User::factory()->create(['name' => 'Maja Medlem']);

    $html = (string) (new MagicLinkNotification('https://tid.example/login/link/abc', 15))->toMail($user)->render();

    expect($html)->toContain('Hej Maja Medlem!')
        ->toContain('Logga in')
        ->toContain('15 minuter')
        ->toContain('Hälsningar,')
        ->toContain('#7c3aed')
        ->toContain('icon-192.png')
        ->not->toContain('Laravel');
});

it('sends Swedish invitation emails', function () {
    $owner = User::factory()->create(['name' => 'Olivia Ägare']);
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => Organization::factory()->create(['name' => 'Demo AB'])->id,
        'invited_by' => $owner->id,
        'email' => 'ny@example.com',
    ]);

    $html = (string) (new OrganizationInvitationNotification($invitation))->toMail(new AnonymousNotifiable)->render();

    expect($html)->toContain('Hej!')
        ->toContain('Olivia Ägare har bjudit in dig till organisationen Demo AB.')
        ->toContain(route('invitations.show', $invitation->code));
});

it('ships a web app manifest with its icons', function () {
    $response = $this->get('/site.webmanifest')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/manifest+json')
        ->assertJsonPath('start_url', '/')
        ->assertJsonPath('scope', '/')
        ->assertJsonPath('lang', 'sv')
        ->assertJsonPath('display', 'standalone')
        ->assertJsonCount(4, 'icons');

    foreach (['any' => 'icon', 'maskable' => 'icon-maskable'] as $purpose => $name) {
        foreach ([192, 512] as $size) {
            $url = Vite::asset("resources/app-icons/{$name}-{$size}.png");

            $response->assertJsonFragment([
                'src' => $url,
                'sizes' => "{$size}x{$size}",
                'type' => 'image/png',
                'purpose' => $purpose,
            ]);

            $path = public_path(parse_url($url, PHP_URL_PATH));
            expect($path)->toBeFile()
                ->and(getimagesize($path))->toMatchArray([$size, $size, IMAGETYPE_PNG]);
        }
    }

    $login = $this->get('/login')
        ->assertSee('rel="manifest" href="/site.webmanifest"', false)
        ->assertSee('name="theme-color"', false);

    foreach ([120, 152, 167, 180] as $size) {
        $url = Vite::asset("resources/app-icons/apple-touch-{$size}.png");

        $login->assertSee("rel=\"apple-touch-icon\" href=\"{$url}\" sizes=\"{$size}x{$size}\"", false);

        $path = public_path(parse_url($url, PHP_URL_PATH));
        expect($path)->toBeFile()
            ->and(getimagesize($path))->toMatchArray([$size, $size, IMAGETYPE_PNG]);
    }
});
