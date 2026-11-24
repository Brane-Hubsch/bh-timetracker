<?php

beforeEach(function (): void {
    config([
        'services.umami.script_url' => 'https://analytics.example.com/script.js',
        'services.umami.website_id' => 'test-website-id',
        'services.umami.domain' => 'tid.example.com',
    ]);
});

it('loads Umami in the initial HTML for the configured domain in production', function (): void {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get('https://tid.example.com/login')
        ->assertOk()
        ->assertSee('https://analytics.example.com/script.js')
        ->assertSee('data-website-id="test-website-id"', escape: false);
});

it('omits Umami on other domains and in other environments', function (string $environment, string $host): void {
    $this->app->detectEnvironment(fn (): string => $environment);

    $this->get("https://{$host}/login")
        ->assertOk()
        ->assertDontSee('https://analytics.example.com/script.js');
})->with([
    ['production', 'staging.example.com'],
    ['local', 'tid.example.com'],
]);

it('omits Umami when it is not configured', function (string $missingSetting): void {
    $this->app->detectEnvironment(fn (): string => 'production');
    config(["services.umami.{$missingSetting}" => null]);

    $this->get('https://tid.example.com/login')
        ->assertOk()
        ->assertDontSee('umami-tracker');
})->with(['script_url', 'website_id', 'domain']);
