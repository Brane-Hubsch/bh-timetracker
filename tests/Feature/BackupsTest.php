<?php

use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;
use Spatie\Backup\Config\Config;
use Spatie\Backup\Notifications\Notifications\BackupHasFailedNotification;
use Spatie\Backup\Notifications\Notifications\UnhealthyBackupWasFoundNotification;

use function Pest\Laravel\artisan;
use function Pest\Laravel\travelTo;

/**
 * Changes the backup config after the package has read it.
 *
 * @param  array<string, mixed>  $values
 */
function configureBackups(array $values): void
{
    config($values);
    app()->forgetInstance(Config::class);
}

it('writes the uploaded images to an encrypted archive on the backups disk', function () {
    Storage::fake('backups');
    Notification::fake();
    configureBackups(['backup.backup.password' => 'correct horse']);
    $directory = storage_path('app/public/images/logos/backup-test');
    File::ensureDirectoryExists($directory);
    File::put("{$directory}/128.webp", 'logo bytes');

    try {
        artisan('backup:run', ['--only-files' => true])->assertSuccessful();
    } finally {
        File::deleteDirectory($directory);
    }

    $archives = Storage::disk('backups')->files('bh-timetracker');
    expect($archives)->toHaveCount(1);

    $zip = new ZipArchive;
    $zip->open(Storage::disk('backups')->path($archives[0]));
    $entry = 'images/logos/backup-test/128.webp';
    $names = array_map(fn (int $index) => $zip->getNameIndex($index), range(0, $zip->numFiles - 1));

    expect($names)->toContain($entry)
        ->each->toStartWith('images/')
        ->and($zip->statName($entry)['encryption_method'] ?? null)->toBe(ZipArchive::EM_AES_256)
        ->and($zip->getFromName($entry))->toBeFalse();

    $zip->setPassword('correct horse');
    expect($zip->getFromName($entry))->toBe('logo bytes');

    // Successful backups don't send mail.
    Notification::assertNothingSent();
});

it('tries a failed backup again after five minutes and then mails', function () {
    Notification::fake();
    Sleep::fake();
    configureBackups(['backup.backup.destination.disks' => ['missing']]);

    artisan('backup:run', ['--only-files' => true]);

    Sleep::assertSequence([Sleep::for(300)->seconds()]);
    Notification::assertSentTimes(BackupHasFailedNotification::class, 1);
});

it('mails when the newest backup is much smaller than the one before it', function (int $newestBytes, bool $isUnhealthy) {
    Storage::fake('backups');
    Notification::fake();
    travelTo('2026-11-19 07:00:00');
    Storage::disk('backups')->put('bh-timetracker/2026-11-18-01-30-00.zip', str_repeat('x', 1000));
    Storage::disk('backups')->put('bh-timetracker/2026-11-19-01-30-00.zip', str_repeat('x', $newestBytes));

    artisan('backup:monitor');

    if ($isUnhealthy) {
        Notification::assertSentTimes(UnhealthyBackupWasFoundNotification::class, 1);
    } else {
        Notification::assertNothingSent();
    }
})->with([
    'a fifth of the size' => [200, true],
    'slightly smaller' => [900, false],
]);

/**
 * Reads config/backup.php with the given environment variables (null: not set).
 *
 * @param  array<string, string|null>  $variables
 * @return array<string, mixed>
 */
function backupConfigWith(array $variables): array
{
    $original = array_map(fn (string $name) => $_SERVER[$name] ?? null, array_keys($variables));

    try {
        foreach ($variables as $name => $value) {
            unset($_SERVER[$name], $_ENV[$name]);

            if ($value !== null) {
                $_SERVER[$name] = $_ENV[$name] = $value;
            }
        }

        return require config_path('backup.php');
    } finally {
        foreach (array_keys($variables) as $index => $name) {
            unset($_SERVER[$name], $_ENV[$name]);

            if ($original[$index] !== null) {
                $_SERVER[$name] = $_ENV[$name] = $original[$index];
            }
        }
    }
}

it('boots when the notification addresses are empty', function () {
    $config = Config::fromArray(backupConfigWith(['BACKUP_NOTIFICATION_EMAIL' => '', 'MAIL_FROM_ADDRESS' => '']));

    expect($config->notifications->mail->to)->toBe('hello@example.com');
});

it('enables backups when a bucket is configured unless BACKUP_ENABLED says otherwise', function (?string $enabled, ?string $bucket, bool $expected) {
    expect(backupConfigWith(['BACKUP_ENABLED' => $enabled, 'BACKUP_AWS_BUCKET' => $bucket])['enabled'])->toBe($expected);
})->with([
    'bucket, not set' => [null, 'backups', true],
    'bucket, empty (compose default)' => ['', 'backups', true],
    'no bucket, not set' => [null, null, false],
    'no bucket, empty' => ['', '', false],
    'bucket, turned off' => ['false', 'backups', false],
    'no bucket, turned on' => ['true', null, true],
]);

it('runs the backups every night in production only', function () {
    $events = collect(app(Schedule::class)->events())
        ->filter(fn (Event $event) => str_contains((string) $event->command, 'backup:'))
        ->mapWithKeys(fn (Event $event) => [(string) str($event->command)->after("'artisan' ") => $event]);

    expect($events->map(fn (Event $event) => $event->expression)->all())->toBe([
        'backup:run' => '30 2 * * *',
        'backup:clean' => '15 3 * * *',
        'backup:monitor' => '0 8 * * *',
    ])
        ->and($events->every(fn (Event $event) => $event->timezone === 'Europe/Stockholm'))->toBeTrue()
        ->and($events->every(fn (Event $event) => $event->runsInEnvironment('production') && ! $event->runsInEnvironment('local')))->toBeTrue();
});

it('skips the scheduled backups when backups are disabled', function (bool $enabled) {
    config(['backup.enabled' => $enabled]);

    $events = collect(app(Schedule::class)->events())
        ->filter(fn (Event $event) => str_contains((string) $event->command, 'backup:'));

    expect($events)->toHaveCount(3)
        ->and($events->every(fn (Event $event) => $event->filtersPass(app()) === $enabled))->toBeTrue();
})->with([
    'enabled' => true,
    'disabled' => false,
]);
