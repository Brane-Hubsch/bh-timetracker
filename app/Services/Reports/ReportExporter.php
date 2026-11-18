<?php

namespace App\Services\Reports;

use App\Enums\ReportGrouping;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\CSV\Options as CsvOptions;
use OpenSpout\Writer\CSV\Writer as CsvWriter;
use OpenSpout\Writer\WriterInterface;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Writes reports to CSV or XLSX. Hours are decimal numbers; amounts are in the currency's major
 * unit and only included for viewers who may see them. CSV uses semicolons and decimal commas so
 * Swedish Excel opens it directly.
 */
class ReportExporter
{
    public function __construct(private readonly ReportBuilder $reports)
    {
        //
    }

    /**
     * @param  'csv'|'xlsx'  $format
     */
    public function summary(ReportFilters $filters, ReportGrouping $grouping, ?ReportGrouping $subGrouping, string $format): BinaryFileResponse
    {
        $summary = $this->reports->summary($filters, $grouping, $subGrouping);
        $amounts = $filters->canViewAmounts();
        $subGrouping = $subGrouping === $grouping ? null : $subGrouping;

        $header = [$grouping->label()];

        if ($subGrouping) {
            $header[] = $subGrouping->label();
        }

        array_push($header, $this->text(__('Hours')), $this->text(__('Billable hours')));

        if ($amounts) {
            $header[] = $this->text(__('Amount (:currency)', ['currency' => $filters->organization->currency]));
        }

        $rows = [$header];

        foreach ($summary['groups'] as $group) {
            $lines = $subGrouping
                ? array_map(fn (array $child) => [[$group['label'], $child['label']], $child], $group['children'])
                : [[[$group['label']], $group]];

            foreach ($lines as [$labels, $source]) {
                $line = [...$labels, $this->hours($source['seconds'], $format), $this->hours($source['billableSeconds'], $format)];

                if ($amounts) {
                    $line[] = $this->money($source['amount'] ?? 0, $format);
                }

                $rows[] = $line;
            }
        }

        $total = [$this->text(__('Total'))];

        if ($subGrouping) {
            $total[] = '';
        }

        array_push($total, $this->hours($summary['totals']['seconds'], $format), $this->hours($summary['totals']['billableSeconds'], $format));

        if ($amounts) {
            $total[] = $this->money($summary['totals']['amount'] ?? 0, $format);
        }

        $rows[] = $total;

        return $this->download($rows, $this->filename($this->text(__('summary')), $filters, $format), $format);
    }

    /**
     * @param  'date'|'duration'|'project'|'member'  $sort
     * @param  'asc'|'desc'  $direction
     * @param  'csv'|'xlsx'  $format
     */
    public function detailed(ReportFilters $filters, string $sort, string $direction, string $format): BinaryFileResponse
    {
        $amounts = $filters->canViewAmounts();
        $header = [$this->text(__('Date')), $this->text(__('Start')), $this->text(__('End')), $this->text(__('Member')), $this->text(__('Client')), $this->text(__('Project')), $this->text(__('Description')), $this->text(__('Hours')), $this->text(__('Billable'))];

        if ($amounts) {
            array_push(
                $header,
                $this->text(__('Hourly rate (:currency)', ['currency' => $filters->organization->currency])),
                $this->text(__('Amount (:currency)', ['currency' => $filters->organization->currency])),
            );
        }

        $rows = (function () use ($filters, $sort, $direction, $format, $amounts, $header) {
            yield $header;

            foreach ($this->reports->detailedForExport($filters, $sort, $direction) as $entry) {
                $row = $this->reports->row($entry, $filters);
                $line = [
                    $row['date'],
                    substr($row['start'], 11),
                    substr($row['end'], 11),
                    $row['memberName'],
                    $row['project']['clientName'] ?? '',
                    $row['project']['name'],
                    $row['description'] ?? '',
                    $this->hours($row['durationSeconds'], $format),
                    $row['isBillable'] ? $this->text(__('Yes')) : $this->text(__('No')),
                ];

                if ($amounts) {
                    array_push($line, $this->money($row['hourlyRate'] ?? 0, $format), $this->money($row['amount'] ?? 0, $format));
                }

                yield $line;
            }
        })();

        return $this->download($rows, $this->filename($this->text(__('entries')), $filters, $format), $format);
    }

    /**
     * @param  iterable<int, array<int, string|int|float>>  $rows
     * @param  'csv'|'xlsx'  $format
     */
    private function download(iterable $rows, string $filename, string $format): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'report');

        if ($path === false) {
            abort(500);
        }

        $writer = $this->writer($format);
        $writer->openToFile($path);

        foreach ($rows as $row) {
            $writer->addRow(Row::fromValues($row));
        }

        $writer->close();

        return response()->download($path, $filename, [
            'Content-Type' => $format === 'csv' ? 'text/csv; charset=UTF-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    /**
     * `__()` may return an array for group keys; report labels are always strings.
     *
     * @param  string|array<mixed>  $translation
     */
    private function text(string|array $translation): string
    {
        return is_string($translation) ? $translation : '';
    }

    /**
     * @param  'csv'|'xlsx'  $format
     */
    private function writer(string $format): WriterInterface
    {
        return $format === 'csv'
            ? new CsvWriter(new CsvOptions(FIELD_DELIMITER: ';'))
            : new XlsxWriter;
    }

    /**
     * @param  'csv'|'xlsx'  $format
     */
    private function hours(int $seconds, string $format): float|string
    {
        $hours = round($seconds / 3600, 2);

        return $format === 'csv' ? number_format($hours, 2, ',', '') : $hours;
    }

    /**
     * @param  'csv'|'xlsx'  $format
     */
    private function money(int $minorUnits, string $format): float|string
    {
        $amount = round($minorUnits / 100, 2);

        return $format === 'csv' ? number_format($amount, 2, ',', '') : $amount;
    }

    /**
     * @param  'csv'|'xlsx'  $format
     */
    private function filename(string $kind, ReportFilters $filters, string $format): string
    {
        $period = $filters->from && $filters->to
            ? $filters->from->toDateString().'_'.$filters->to->toDateString()
            : now($filters->timezone())->toDateString();

        return sprintf('%s-%s-%s.%s', str($filters->organization->slug)->slug(), str($kind)->slug(), $period, $format);
    }
}
