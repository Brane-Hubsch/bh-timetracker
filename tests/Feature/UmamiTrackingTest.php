<?php

it('loads Umami in the initial HTML for the production domain', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get('https://timetrack.bh.studio/login')
        ->assertOk()
        ->assertSee('https://analytics.bh.studio/script.js')
        ->assertSee('data-website-id="'.config('services.umami.website_id').'"', escape: false);
});

it('omits Umami on other domains and in other environments', function (string $environment, string $host): void {
    $this->app->detectEnvironment(fn (): string => $environment);

    $this->get("https://{$host}/login")
        ->assertOk()
        ->assertDontSee('https://analytics.bh.studio/script.js');
})->with([
    ['production', 'staging.example.com'],
    ['local', 'timetrack.bh.studio'],
]);
