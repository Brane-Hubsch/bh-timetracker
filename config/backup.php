<?php

use App\Support\Backups\NewestBackupIsNotMuchSmaller;
use Spatie\Backup\Notifications\Notifiable;
use Spatie\Backup\Notifications\Notifications\BackupHasFailedNotification;
use Spatie\Backup\Notifications\Notifications\BackupWasSuccessfulNotification;
use Spatie\Backup\Notifications\Notifications\CleanupHasFailedNotification;
use Spatie\Backup\Notifications\Notifications\CleanupWasSuccessfulNotification;
use Spatie\Backup\Notifications\Notifications\HealthyBackupWasFoundNotification;
use Spatie\Backup\Notifications\Notifications\UnhealthyBackupWasFoundNotification;
use Spatie\Backup\Tasks\Cleanup\Strategies\DefaultStrategy;
use Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumAgeInDays;
use Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumStorageInMegabytes;
use Spatie\DbDumper\Compressors\GzipCompressor;

/*
 * Nightly backups (spatie/laravel-backup), scheduled in routes/console.php: a dump of the database and
 * the uploaded images, zipped, encrypted with BACKUP_ARCHIVE_PASSWORD and written to the "backups"
 * disk (an S3-compatible bucket such as Cloudflare R2, see config/filesystems.php). Restoring is
 * described in docs/self-hosting.md.
 */

$name = env('BACKUP_NAME', 'bh-timetracker');
$disk = env('BACKUP_DISK', 'backups');

return [

    'backup' => [
        /*
         * Also the directory in the bucket the archives are written to.
         */
        'name' => $name,

        'source' => [
            'files' => [
                /*
                 * Only the uploaded images: everything else is in git or can be rebuilt. When the
                 * images live in a bucket themselves (IMAGES_DISK=s3), protect that bucket with
                 * versioning instead.
                 */
                'include' => env('IMAGES_DISK', 'public') === 'public' ? [storage_path('app/public/images')] : [],

                'exclude' => [],

                'follow_links' => false,

                'ignore_unreadable_directories' => false,

                /*
                 * Paths in the archive start at images/, matching the public disk.
                 */
                'relative_path' => storage_path('app/public'),
            ],

            /*
             * pg_dump must be installed on the server in the same major version as the database
             * server (set DB_DUMP_BINARY_PATH, see config/database.php, when it is not on the PATH).
             */
            'databases' => [
                env('DB_CONNECTION', 'sqlite'),
            ],
        ],

        'database_dump_compressor' => GzipCompressor::class,

        'database_dump_file_timestamp_format' => null,

        'database_dump_filename_base' => 'database',

        'database_dump_file_extension' => '',

        'destination' => [
            'compression_method' => ZipArchive::CM_DEFAULT,

            'compression_level' => 9,

            'filename_prefix' => '',

            'disks' => [
                $disk,
            ],

            'continue_on_failure' => false,
        ],

        'temporary_directory' => storage_path('app/backup-temp'),

        /*
         * Archives are encrypted with AES-256. Keep the password outside the server as well: without
         * it the backups cannot be opened.
         */
        'password' => env('BACKUP_ARCHIVE_PASSWORD'),

        'encryption' => 'aes256',

        'verify_backup' => true,

        /*
         * A second try covers a short network or bucket hiccup.
         */
        'tries' => 2,

        'retry_delay' => 300,
    ],

    /*
     * Mail only when something is wrong; successful runs are logged.
     */
    'notifications' => [
        'notifications' => [
            BackupHasFailedNotification::class => ['mail'],
            UnhealthyBackupWasFoundNotification::class => ['mail'],
            CleanupHasFailedNotification::class => ['mail'],
            BackupWasSuccessfulNotification::class => [],
            HealthyBackupWasFoundNotification::class => [],
            CleanupWasSuccessfulNotification::class => [],
        ],

        'notifiable' => Notifiable::class,

        /*
         * The package validates these addresses whenever the app boots, so an empty or missing value
         * must fall back to a valid address instead of breaking every artisan command.
         */
        'mail' => [
            'to' => env('BACKUP_NOTIFICATION_EMAIL') ?: (env('MAIL_FROM_ADDRESS') ?: 'hello@example.com'),

            'from' => [
                'address' => env('MAIL_FROM_ADDRESS') ?: 'hello@example.com',
                'name' => env('MAIL_FROM_NAME', env('APP_NAME', 'BH Timetracker')),
            ],
        ],

        'slack' => [
            'webhook_url' => '',
            'channel' => null,
            'username' => null,
            'icon' => null,
        ],

        'discord' => [
            'webhook_url' => '',
            'username' => '',
            'avatar_url' => '',
        ],

        'webhook' => [
            'url' => '',
        ],
    ],

    'log_channel' => null,

    /*
     * Checked every morning by backup:monitor: the newest backup must be less than a day old, not much
     * smaller than the one before it, and all backups together must stay below the size limit.
     */
    'monitor_backups' => [
        [
            'name' => $name,
            'disks' => [$disk],
            'health_checks' => [
                MaximumAgeInDays::class => 1,
                NewestBackupIsNotMuchSmaller::class => 0.5,
                MaximumStorageInMegabytes::class => 5000,
            ],
        ],
    ],

    'cleanup' => [
        'strategy' => DefaultStrategy::class,

        /*
         * The periods follow each other: every backup for a week, one a day until 30 days, then one a
         * week for another 8 weeks and one a month for another 12 months. The newest backup is
         * never deleted.
         */
        'default_strategy' => [
            'keep_all_backups_for_days' => 7,

            'keep_daily_backups_for_days' => 23,

            'keep_weekly_backups_for_weeks' => 8,

            'keep_monthly_backups_for_months' => 12,

            'keep_yearly_backups_for_years' => 0,

            'delete_oldest_backups_when_using_more_megabytes_than' => 5000,
        ],

        'tries' => 2,

        'retry_delay' => 300,
    ],

];
