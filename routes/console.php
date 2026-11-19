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

Schedule::command('passport:purge')->daily()->description('Purge revoked and expired OAuth tokens (MCP clients)');

/*
 * Nightly backups to the backups bucket (config/backup.php), in production only. Times are Swedish
 * time; mail is sent only when something fails or the newest backup looks wrong.
 */
Schedule::command('backup:run')->dailyAt('02:30')->timezone('Europe/Stockholm')
    ->environments(['production'])->onOneServer()->withoutOverlapping()
    ->description('Back up the database and uploaded images');

Schedule::command('backup:clean')->dailyAt('03:15')->timezone('Europe/Stockholm')
    ->environments(['production'])->onOneServer()->withoutOverlapping()
    ->description('Delete old backups');

Schedule::command('backup:monitor')->dailyAt('08:00')->timezone('Europe/Stockholm')
    ->environments(['production'])->onOneServer()
    ->description('Check that the newest backup is recent and complete');
