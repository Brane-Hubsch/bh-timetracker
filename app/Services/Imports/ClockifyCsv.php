<?php

namespace App\Services\Imports;

use App\Data\ClockifyRow;
use DateTimeImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Reads a Clockify CSV export (the detailed report or the user data export). Columns are found by
 * their header, the date format (e.g. MM-DD-YYYY or YYYY-MM-DD) is detected from the whole file,
 * and rows that cannot be read are reported with their line number instead of failing the file.
 */
final class ClockifyCsv
{
    /** Largest number of entries in one file. */
    public const int MAX_ROWS = 20000;

    /** Columns every export must have. */
    private const array REQUIRED = ['project', 'client', 'description', 'user', 'email', 'start date', 'start time', 'end date', 'end time'];

    /** Date formats Clockify can export, in the order they are tried (US first, as Clockify defaults to it). */
    private const array DATE_FORMATS = ['m-d-Y', 'd-m-Y', 'Y-m-d', 'm/d/Y', 'd/m/Y', 'Y/m/d', 'd.m.Y'];

    private const array TIME_FORMATS = ['G:i', 'H:i', 'G:i:s', 'H:i:s', 'g:i A', 'h:i A', 'g:i:s A', 'h:i:s A', 'g:iA', 'h:iA'];

    /**
     * @param  array<int, ClockifyRow>  $rows
     * @param  array<int, array{line: int, message: string}>  $errors
     */
    private function __construct(
        public readonly array $rows,
        public readonly array $errors,
        public readonly string $dateFormat,
    ) {
        //
    }

    /**
     * @throws ValidationException when the file is not a Clockify export at all
     */
    public static function read(string $path): self
    {
        $contents = @file_get_contents($path);

        if ($contents === false) {
            throw ValidationException::withMessages(['file' => __('The file could not be read.')]);
        }

        return self::fromString($contents);
    }

    /**
     * @throws ValidationException when the text is not a Clockify export at all
     */
    public static function fromString(string $contents): self
    {
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            throw ValidationException::withMessages(['file' => __('The file could not be read.')]);
        }

        fwrite($handle, $contents);
        rewind($handle);

        try {
            $firstLine = (string) fgets($handle);
            $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
            $header = str_getcsv(self::stripBom($firstLine), $delimiter, '"', '');
            $columns = self::columns($header);

            $raw = [];
            $line = 1;

            while (($values = fgetcsv($handle, null, $delimiter, '"', '')) !== false) {
                $line++;

                if ($values === [null]) {
                    continue;
                }

                if (count($raw) >= self::MAX_ROWS) {
                    throw ValidationException::withMessages(['file' => __('The file has more than :max entries. Export a shorter period at a time.', ['max' => self::MAX_ROWS])]);
                }

                $raw[$line] = $values;
            }
        } finally {
            fclose($handle);
        }

        $value = fn (array $values, string $column): string => isset($columns[$column]) ? trim((string) ($values[$columns[$column]] ?? '')) : '';

        $dateFormat = self::detectDateFormat(array_merge(
            array_map(fn (array $values) => $value($values, 'start date'), $raw),
            array_map(fn (array $values) => $value($values, 'end date'), $raw),
        ));

        $rows = [];
        $errors = [];

        foreach ($raw as $line => $values) {
            $email = mb_strtolower($value($values, 'email'));
            $start = self::dateTime($value($values, 'start date'), $value($values, 'start time'), $dateFormat);
            $end = self::dateTime($value($values, 'end date'), $value($values, 'end time'), $dateFormat);

            if ($email === '') {
                $errors[] = ['line' => $line, 'message' => __('The row has no email address.')];

                continue;
            }

            if ($start === null || $end === null) {
                $errors[] = ['line' => $line, 'message' => __('The date or time could not be read.')];

                continue;
            }

            $tags = $value($values, 'tags');
            $billable = mb_strtolower($value($values, 'billable'));

            $rows[] = new ClockifyRow(
                line: $line,
                email: $email,
                userName: $value($values, 'user') ?: $email,
                client: $value($values, 'client') ?: null,
                project: $value($values, 'project') ?: null,
                task: $value($values, 'task') ?: null,
                description: $value($values, 'description') ?: null,
                tags: $tags === '' ? [] : array_values(array_filter(array_map('trim', explode(',', $tags)))),
                start: $start,
                end: $end,
                billable: match ($billable) {
                    'yes', 'true', '1', 'ja' => true,
                    'no', 'false', '0', 'nej' => false,
                    default => null,
                },
            );
        }

        return new self($rows, $errors, $dateFormat);
    }

    /**
     * Column positions by lower-cased header name.
     *
     * @param  array<int, string|null>  $header
     * @return array<string, int>
     *
     * @throws ValidationException
     */
    private static function columns(array $header): array
    {
        $columns = [];

        foreach ($header as $index => $name) {
            $columns[mb_strtolower(trim((string) $name))] ??= $index;
        }

        $missing = array_values(array_diff(self::REQUIRED, array_keys($columns)));

        if ($missing !== []) {
            throw ValidationException::withMessages(['file' => __('This does not look like a Clockify CSV export. Missing columns: :columns.', [
                'columns' => implode(', ', array_map('ucwords', $missing)),
            ])]);
        }

        return $columns;
    }

    /**
     * The first format that reads every date in the file.
     *
     * @param  array<int, string>  $dates
     */
    private static function detectDateFormat(array $dates): string
    {
        $dates = array_values(array_unique(array_filter($dates)));

        foreach (self::DATE_FORMATS as $format) {
            if (array_all($dates, fn (string $date) => self::parse($date, $format) !== null)) {
                return $format;
            }
        }

        return self::DATE_FORMATS[0];
    }

    private static function dateTime(string $date, string $time, string $dateFormat): ?string
    {
        $day = self::parse($date, $dateFormat);
        $clock = null;
        $time = strtoupper(str_replace('.', ':', $time));

        foreach (self::TIME_FORMATS as $format) {
            $clock = self::parse($time, $format);

            if ($clock !== null) {
                break;
            }
        }

        return $day === null || $clock === null ? null : $day->format('Y-m-d').' '.$clock->format('H:i:s');
    }

    /**
     * Strict parse: the value must round-trip, so "13-01-2026" is not read as month 13.
     */
    private static function parse(string $value, string $format): ?DateTimeImmutable
    {
        $parsed = DateTimeImmutable::createFromFormat('!'.$format, $value);

        return $parsed !== false && $parsed->format($format) === $value ? $parsed : null;
    }

    private static function stripBom(string $line): string
    {
        return str_starts_with($line, "\u{FEFF}") ? substr($line, 3) : $line;
    }
}
