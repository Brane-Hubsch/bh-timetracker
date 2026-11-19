<?php

namespace App\Services\Reports;

use App\Enums\ReportGrouping;
use App\Models\Client;
use App\Models\Project;
use App\Models\Tag;
use App\Services\Images\ImageStorage;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Number;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\CSV\Options as CsvOptions;
use OpenSpout\Writer\CSV\Writer as CsvWriter;
use OpenSpout\Writer\WriterInterface;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Writes reports to CSV, XLSX or PDF. Hours are decimal numbers; amounts are in the currency's major
 * unit and only included for viewers who may see them. CSV uses semicolons and decimal commas so
 * Swedish Excel opens it directly. PDFs are rendered from Blade views (`reports/pdf`) with dompdf,
 * in the app's typeface (Inter, bundled in resources/fonts/inter).
 */
class ReportExporter
{
    public function __construct(
        private readonly ReportBuilder $reports,
        private readonly ImageStorage $images,
    ) {
        //
    }

    /**
     * @param  'csv'|'xlsx'|'pdf'  $format
     */
    public function summary(ReportFilters $filters, ReportGrouping $grouping, ?ReportGrouping $subGrouping, string $format): Response
    {
        if ($format === 'pdf') {
            return $this->pdf($this->summaryDocument($filters, $grouping, $subGrouping), $this->filename($this->text(__('summary')), $filters, 'pdf'));
        }

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
     * @param  'csv'|'xlsx'|'pdf'  $format
     */
    public function detailed(ReportFilters $filters, string $sort, string $direction, string $format): Response
    {
        if ($format === 'pdf') {
            return $this->pdf($this->detailedDocument($filters, $sort, $direction), $this->filename($this->text(__('entries')), $filters, 'pdf'), 'landscape');
        }

        $amounts = $filters->canViewAmounts();
        $header = [$this->text(__('Date')), $this->text(__('Start')), $this->text(__('End')), $this->text(__('Member')), $this->text(__('Client')), $this->text(__('Project')), $this->text(__('Description')), $this->text(__('Tags')), $this->text(__('Hours')), $this->text(__('Billable'))];

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
                    implode(', ', $row['tags']),
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
     * The summary as a printable document: period and filters, totals and the grouped table.
     */
    public function summaryDocument(ReportFilters $filters, ReportGrouping $grouping, ?ReportGrouping $subGrouping): View
    {
        $summary = $this->reports->summary($filters, $grouping, $subGrouping);

        return view('reports.pdf.summary', [
            ...$this->documentContext($filters, $this->text(__('Summary'))),
            'grouping' => $grouping,
            'subGrouping' => $subGrouping === $grouping ? null : $subGrouping,
            'summary' => $summary,
            'timeline' => $this->timelineChart($summary['timeline']),
            'projectShares' => $this->projectChart($summary['projects'], $summary['totals']['seconds']),
        ]);
    }

    /**
     * The detailed report as a printable document: every entry in the period, then the totals.
     *
     * @param  'date'|'duration'|'project'|'member'  $sort
     * @param  'asc'|'desc'  $direction
     */
    public function detailedDocument(ReportFilters $filters, string $sort, string $direction): View
    {
        $rows = (function () use ($filters, $sort, $direction) {
            foreach ($this->reports->detailedForExport($filters, $sort, $direction) as $entry) {
                yield $this->reports->row($entry, $filters);
            }
        })();

        $summary = $this->reports->summary($filters, ReportGrouping::Project);

        return view('reports.pdf.detailed', [
            ...$this->documentContext($filters, $this->text(__('Detailed report'))),
            'rows' => $rows,
            'totals' => $summary['totals'],
            'timeline' => $this->timelineChart($summary['timeline']),
        ]);
    }

    /**
     * Header, footer and formatting shared by the PDF documents.
     *
     * @return array<string, mixed>
     */
    private function documentContext(ReportFilters $filters, string $title): array
    {
        $locale = app()->getLocale();
        $currency = $filters->organization->currency;

        return [
            'title' => $title,
            'organization' => $filters->organization->name,
            'organizationLogo' => $this->images->dataUri($filters->organization->logo_path),
            'client' => $this->singleClient($filters),
            'period' => $filters->from && $filters->to
                ? $this->date($filters->from).' – '.$this->date($filters->to)
                : $this->text(__('All time')),
            'criteria' => $this->criteria($filters),
            'showMembers' => $filters->canViewTeam(),
            'showAmounts' => $filters->canViewAmounts(),
            'generated' => $this->text(__('Created :date by :name', [
                'date' => CarbonImmutable::now($filters->timezone())->settings(['locale' => $locale])->isoFormat('D MMM YYYY HH:mm'),
                'name' => $filters->viewer->name,
            ])),
            'hours' => fn (int $seconds): string => Number::format($seconds / 3600, maxPrecision: 2, locale: $locale).' h',
            'money' => fn (?int $minorUnits): string => $minorUnits === null ? '–' : (string) Number::currency($minorUnits / 100, in: $currency, locale: $locale),
            'formatDate' => fn (string $date): string => $this->date(CarbonImmutable::parse($date)),
        ];
    }

    /**
     * The client a report is limited to, with its logo, when it covers exactly one.
     *
     * @return array{name: string, logo: string|null}|null
     */
    private function singleClient(ReportFilters $filters): ?array
    {
        if (count($filters->clientIds) !== 1) {
            return null;
        }

        $client = Client::query()->forOrganization($filters->organization)->find($filters->clientIds[0]);

        return $client === null ? null : ['name' => $client->name, 'logo' => $this->images->dataUri($client->logo_path)];
    }

    /**
     * Hours per day (or week) as columns: a round axis with at most four steps, one bar per bucket
     * and a label on every few buckets so they never collide.
     *
     * @param  array{unit: string, buckets: array<int, array{key: string, seconds: int, billableSeconds: int}>}  $timeline
     * @return array{title: string, max: int, ticks: array<int, int>, bars: array<int, array{ratio: float, label: string}>}
     */
    private function timelineChart(array $timeline): array
    {
        $buckets = $timeline['buckets'];
        $maxHours = max(1, max([0, ...array_column($buckets, 'seconds')]) / 3600);
        $step = 1000;

        foreach ([1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200, 250, 500] as $candidate) {
            if ($maxHours / $candidate <= 4) {
                $step = $candidate;
                break;
            }
        }

        $max = (int) (ceil($maxHours / $step) * $step);
        $labelEvery = max(1, (int) ceil(count($buckets) / 10));
        $isWeekly = $timeline['unit'] === ReportGrouping::Week->value;

        return [
            'title' => $this->text($isWeekly ? __('Hours per week') : __('Hours per day')),
            'max' => $max,
            'ticks' => range(0, $max, $step),
            'bars' => array_map(fn (array $bucket, int $index) => [
                'ratio' => $bucket['seconds'] / 3600 / $max,
                'label' => $index % $labelEvery !== 0 ? '' : ($isWeekly
                    ? $this->text(__('w. :number', ['number' => CarbonImmutable::parse($bucket['key'])->isoWeek()]))
                    : CarbonImmutable::parse($bucket['key'])->format('j/n')),
            ], $buckets, array_keys($buckets)),
        ];
    }

    /**
     * Time per project as horizontal bars in the builder's order (largest first, with the smallest
     * projects already folded into "Other projects" at the end), scaled to the largest bar.
     *
     * @param  array<int, array{id: int|null, name: string, color: string|null, clientName: string|null, seconds: int}>  $projects
     * @return array<int, array{name: string, clientName: string|null, color: string, seconds: int, percent: int, ratio: float}>
     */
    private function projectChart(array $projects, int $totalSeconds): array
    {
        $largest = max(1, max([0, ...array_column($projects, 'seconds')]));

        return array_map(fn (array $project) => [
            'name' => $project['name'],
            'clientName' => $project['clientName'],
            'color' => $project['color'] ?? '#a1a1aa',
            'seconds' => $project['seconds'],
            'percent' => $totalSeconds > 0 ? (int) round($project['seconds'] / $totalSeconds * 100) : 0,
            'ratio' => $project['seconds'] / $largest,
        ], $projects);
    }

    /**
     * The filters in words, for the document header. Names are looked up within the organization.
     *
     * @return array<int, array{label: string, value: string}>
     */
    private function criteria(ReportFilters $filters): array
    {
        $organization = $filters->organization;
        $criteria = [];

        if (! $filters->canViewTeam()) {
            $criteria[] = ['label' => $this->text(__('Member')), 'value' => $filters->viewer->name];
        } elseif ($filters->userIds !== []) {
            $criteria[] = [
                'label' => $this->text(__('Members')),
                'value' => $organization->members()->whereIn('users.id', $filters->userIds)->orderBy('name')->pluck('name')->implode(', '),
            ];
        }

        if ($filters->clientIds !== []) {
            $criteria[] = [
                'label' => $this->text(__('Clients')),
                'value' => Client::query()->forOrganization($organization)->whereIn('id', $filters->clientIds)->orderBy('name')->pluck('name')->implode(', '),
            ];
        }

        if ($filters->projectIds !== []) {
            $criteria[] = [
                'label' => $this->text(__('Projects')),
                'value' => Project::query()->forOrganization($organization)->whereIn('id', $filters->projectIds)->orderBy('name')->pluck('name')->implode(', '),
            ];
        }

        if ($filters->tagIds !== []) {
            $criteria[] = [
                'label' => $this->text(__('Tags')),
                'value' => Tag::query()->forOrganization($organization)->whereIn('id', $filters->tagIds)->get(['id', 'name'])
                    ->sortBy(fn (Tag $tag) => mb_strtolower($tag->name))
                    ->map(fn (Tag $tag) => $tag->name)
                    ->implode(', '),
            ];
        }

        if ($filters->billable !== null) {
            $criteria[] = [
                'label' => $this->text(__('Billable')),
                'value' => $this->text($filters->billable ? __('Billable only') : __('Non-billable only')),
            ];
        }

        return $criteria;
    }

    private function date(CarbonImmutable $date): string
    {
        return $date->settings(['locale' => app()->getLocale()])->isoFormat('D MMM YYYY');
    }

    /**
     * @param  'portrait'|'landscape'  $orientation
     */
    private function pdf(View $document, string $filename, string $orientation = 'portrait'): Response
    {
        // Embed only the glyphs that are used, so the bundled Inter files keep PDFs small.
        $pdf = Pdf::setOption('isFontSubsettingEnabled', true)
            ->loadHTML($document->render())
            ->setPaper('a4', $orientation);
        $dompdf = $pdf->getDomPDF();
        $dompdf->render();

        // "1 / 3" in the bottom right corner, level with the footer (CSS cannot count the pages).
        $font = $dompdf->getFontMetrics()->getFont('Inter') ?? $dompdf->getFontMetrics()->getFont('DejaVu Sans');

        if ($font !== null) {
            $canvas = $dompdf->getCanvas();
            $size = 7;
            $width = $dompdf->getFontMetrics()->getTextWidth('00 / 00', $font, $size);
            $canvas->page_text($canvas->get_width() - 14 / 25.4 * 72 - $width, $canvas->get_height() - 7 / 25.4 * 72 - $size - 1.5, '{PAGE_NUM} / {PAGE_COUNT}', $font, $size, [0.44, 0.44, 0.48]);
        }

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
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
     * @param  'csv'|'xlsx'|'pdf'  $format
     */
    private function filename(string $kind, ReportFilters $filters, string $format): string
    {
        $period = $filters->from && $filters->to
            ? $filters->from->toDateString().'_'.$filters->to->toDateString()
            : now($filters->timezone())->toDateString();

        return sprintf('%s-%s-%s.%s', str($filters->organization->slug)->slug(), str($kind)->slug(), $period, $format);
    }
}
