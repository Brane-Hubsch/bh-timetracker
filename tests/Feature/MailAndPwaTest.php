<?php

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Notifications\AnonymousNotifiable;

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
    $manifest = json_decode((string) file_get_contents(public_path('site.webmanifest')), true, flags: JSON_THROW_ON_ERROR);

    expect($manifest['lang'])->toBe('sv')
        ->and($manifest['display'])->toBe('standalone');

    foreach ($manifest['icons'] as $icon) {
        expect(public_path(ltrim($icon['src'], '/')))->toBeFile();
    }

    $this->get('/login')->assertSee('rel="manifest"', false)->assertSee('name="theme-color"', false);
});
