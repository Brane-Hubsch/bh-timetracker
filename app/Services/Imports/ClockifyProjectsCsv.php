<?php

namespace App\Services\Imports;

use App\Data\ClockifyProjectRow;
use Illuminate\Validation\ValidationException;

/**
 * Reads Clockify's project export (Projects → Export → CSV): name, client, status, visibility,
 * estimate, note and members per project. Told apart from a time export by its columns.
 */
final class ClockifyProjectsCsv
{
    /** Largest number of projects in one file. */
    public const int MAX_ROWS = 5000;

    /** Columns that make a file a project export. */
    private const array REQUIRED = ['project', 'client', 'status', 'visibility'];

    /**
     * @param  array<int, ClockifyProjectRow>  $rows
     */
    private function __construct(public readonly array $rows)
    {
        //
    }

    /**
     * Whether the text is a project export rather than a time export.
     */
    public static function matches(string $contents): bool
    {
        $columns = array_keys(self::columns(self::header($contents)));

        return array_diff(self::REQUIRED, $columns) === [] && ! in_array('start date', $columns, true);
    }

    /**
     * @throws ValidationException when the text is not a project export
     */
    public static function fromString(string $contents): self
    {
        if (! self::matches($contents)) {
            throw ValidationException::withMessages(['file' => __('This does not look like a Clockify CSV export. Missing columns: :columns.', [
                'columns' => implode(', ', array_map('ucwords', self::REQUIRED)),
            ])]);
        }

        $delimiter = self::delimiter($contents);
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            throw ValidationException::withMessages(['file' => __('The file could not be read.')]);
        }

        fwrite($handle, $contents);
        rewind($handle);
        $columns = self::columns(str_getcsv(self::stripBom((string) fgets($handle)), $delimiter, '"', ''));
        $rows = [];
        $line = 1;

        try {
            while (($values = fgetcsv($handle, null, $delimiter, '"', '')) !== false) {
                $line++;
                $value = fn (string $column): string => isset($columns[$column]) ? trim((string) ($values[$columns[$column]] ?? '')) : '';

                if ($values === [null] || $value('project') === '') {
                    continue;
                }

                if (count($rows) >= self::MAX_ROWS) {
                    throw ValidationException::withMessages(['file' => __('The file has more than :max entries. Export a shorter period at a time.', ['max' => self::MAX_ROWS])]);
                }

                $estimate = str_replace(',', '.', $value('estimated (h)'));
                $members = $value('project members');

                $rows[] = new ClockifyProjectRow(
                    line: $line,
                    name: $value('project'),
                    client: $value('client') ?: null,
                    archived: mb_strtolower($value('status')) === 'archived',
                    private: mb_strtolower($value('visibility')) === 'private',
                    estimateSeconds: is_numeric($estimate) && (float) $estimate > 0 ? (int) round((float) $estimate * 3600) : null,
                    note: $value('note') ?: null,
                    memberNames: $members === '' ? [] : array_values(array_filter(array_map('trim', explode(',', $members)))),
                );
            }
        } finally {
            fclose($handle);
        }

        return new self($rows);
    }

    /**
     * @return array<int, string|null>
     */
    private static function header(string $contents): array
    {
        $firstLine = strtok($contents, "\n");

        return str_getcsv(self::stripBom((string) $firstLine), self::delimiter($contents), '"', '');
    }

    private static function delimiter(string $contents): string
    {
        $firstLine = (string) strtok($contents, "\n");

        return substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
    }

    /**
     * Column positions by lower-cased header name.
     *
     * @param  array<int, string|null>  $header
     * @return array<string, int>
     */
    private static function columns(array $header): array
    {
        $columns = [];

        foreach ($header as $index => $name) {
            $columns[mb_strtolower(trim((string) $name))] ??= $index;
        }

        return $columns;
    }

    private static function stripBom(string $line): string
    {
        return str_starts_with($line, "\u{FEFF}") ? substr($line, 3) : $line;
    }
}
