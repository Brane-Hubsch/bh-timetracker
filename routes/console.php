<?php

use App\Models\MagicLink;
use App\Models\OrganizationInvitation;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function () {
    OrganizationInvitation::query()
        ->whereNotNull('expires_at')
        ->where('expires_at', '<', now())
        ->delete();
})->daily()->description('Delete expired organization invitations');

Schedule::command('model:prune', ['--model' => [MagicLink::class]])->daily()->description('Prune expired magic sign-in links');
