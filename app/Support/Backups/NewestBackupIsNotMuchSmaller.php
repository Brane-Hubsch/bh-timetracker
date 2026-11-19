<?php

namespace App\Support\Backups;

use Spatie\Backup\BackupDestination\BackupDestination;
use Spatie\Backup\Tasks\Monitor\HealthCheck;

/**
 * Flags a newest backup that is much smaller than the one before it: the data only grows (time entries
 * are soft deleted), so a sudden drop usually means an empty or broken dump.
 */
class NewestBackupIsNotMuchSmaller extends HealthCheck
{
    /**
     * @param  float  $minimumRatio  the smallest accepted size of the newest backup, relative to the previous one
     */
    public function __construct(protected float $minimumRatio = 0.5) {}

    public function checkHealth(BackupDestination $backupDestination): void
    {
        $backups = $backupDestination->backups();
        $newest = $backups->get(0);
        $previous = $backups->get(1);

        if ($newest === null || $previous === null || $previous->sizeInBytes() <= 0) {
            return;
        }

        $this->failIf(
            $newest->sizeInBytes() < $previous->sizeInBytes() * $this->minimumRatio,
            sprintf(
                'The latest backup (%s) is less than %d%% of the size of the one before it (%s).',
                $this->kilobytes($newest->sizeInBytes()),
                (int) round($this->minimumRatio * 100),
                $this->kilobytes($previous->sizeInBytes()),
            ),
        );
    }

    private function kilobytes(float $bytes): string
    {
        return number_format($bytes / 1024, 0, '.', ' ').' KB';
    }
}
