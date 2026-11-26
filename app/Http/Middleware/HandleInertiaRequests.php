<?php

namespace App\Http\Middleware;

use App\Models\RunningTimer;
use App\Support\CurrentOrganization;
use App\Support\TimerPresenter;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $currentOrganization = app(CurrentOrganization::class);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'locale' => app()->getLocale(),
            'auth' => [
                'user' => $user,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'sidebarHiddenItems' => $user?->sidebar_hidden_items,
            'sidebarOrder' => $user?->sidebar_order,
            'currentOrganization' => fn () => $user && ($organization = $currentOrganization->get()) ? $user->toUserOrganization($organization) : null,
            'organizations' => fn () => $user?->toUserOrganizations(includeCurrent: true) ?? [],
            // The person's running timer, in any of their organizations.
            'timer' => fn () => $user && ($timer = RunningTimer::runningFor($user)) ? TimerPresenter::present($timer, $user) : null,
            'can' => fn () => $user && ($organization = $currentOrganization->get()) ? $user->toOrganizationPermissions($organization) : null,
        ];
    }
}
