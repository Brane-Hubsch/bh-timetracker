<?php

use App\Services\Imports\ClockifyCsv;
use Illuminate\Validation\ValidationException;

it('reads entries with local times, the task and tags', function () {
    $csv = ClockifyCsv::fromString("\u{FEFF}".clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'Anna@Example.com', '11-30-2026', '9:00', '11-30-2026', '17:30', 'installer app', 'Utveckling', 'SOPF, Möte'),
        clockifyRow('Intern', '', 'anna@example.com', '11-04-2026', '21:30', '11-05-2026', '0:00'),
    ]));

    expect($csv->errors)->toBe([])
        ->and($csv->dateFormat)->toBe('m-d-Y')
        ->and($csv->rows)->toHaveCount(2);

    [$first, $second] = $csv->rows;

    expect($first->line)->toBe(2)
        ->and($first->email)->toBe('anna@example.com')
        ->and($first->client)->toBe('Acme')
        ->and($first->start)->toBe('2026-11-30 09:00:00')
        ->and($first->end)->toBe('2026-11-30 17:30:00')
        ->and($first->tags)->toBe(['SOPF', 'Möte'])
        ->and($first->combinedDescription())->toBe('Utveckling – installer app')
        ->and($second->client)->toBeNull()
        ->and($second->end)->toBe('2026-11-05 00:00:00')
        ->and($second->combinedDescription())->toBeNull();
});

it('detects day-first, ISO and 12-hour formats and semicolons', function (string $startDate, string $startTime, string $endTime, string $format, string $start, string $end) {
    $csv = ClockifyCsv::fromString(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', $startDate, $startTime, $startDate, $endTime),
    ], str_replace(',', ';', CLOCKIFY_HEADER), ';'));

    expect($csv->errors)->toBe([])
        ->and($csv->dateFormat)->toBe($format)
        ->and($csv->rows[0]->start)->toBe($start)
        ->and($csv->rows[0]->end)->toBe($end);
})->with([
    'day first' => ['30/11/2026', '09:00', '17:00', 'd/m/Y', '2026-11-30 09:00:00', '2026-11-30 17:00:00'],
    'iso' => ['2026-11-30', '9:00', '17:00', 'Y-m-d', '2026-11-30 09:00:00', '2026-11-30 17:00:00'],
    '12-hour' => ['11/30/2026', '9:00 AM', '5:30 PM', 'm/d/Y', '2026-11-30 09:00:00', '2026-11-30 17:30:00'],
]);

it('reads a billable column when the export has one', function () {
    $header = CLOCKIFY_HEADER.',"Billable"';
    $csv = ClockifyCsv::fromString(clockifyCsv([
        [...clockifyRow('Webbshop', 'Acme', 'anna@example.com', '2026-11-30', '9:00', '2026-11-30', '10:00'), 'Yes'],
        [...clockifyRow('Webbshop', 'Acme', 'anna@example.com', '2026-11-30', '10:00', '2026-11-30', '11:00'), 'No'],
    ], $header));

    expect($csv->rows[0]->billable)->toBeTrue()
        ->and($csv->rows[1]->billable)->toBeFalse();
});

it('reports unreadable rows by line instead of failing the file', function () {
    $csv = ClockifyCsv::fromString(clockifyCsv([
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '2026-11-30', '9:00', '2026-11-30', '10:00'),
        clockifyRow('Webbshop', 'Acme', '', '2026-11-30', '9:00', '2026-11-30', '10:00'),
        clockifyRow('Webbshop', 'Acme', 'anna@example.com', '2026-11-30', 'lunch', '2026-11-30', '10:00'),
    ]));

    expect($csv->rows)->toHaveCount(1)
        ->and(array_column($csv->errors, 'line'))->toBe([3, 4]);
});

it('rejects files that are not Clockify exports', function () {
    ClockifyCsv::fromString("Name,Hours\nAnna,8\n");
})->throws(ValidationException::class, 'Kolumner som saknas: Project, Client');
