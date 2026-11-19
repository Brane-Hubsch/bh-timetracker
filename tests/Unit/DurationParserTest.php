<?php

use App\Support\DurationParser;

it('parses human durations', function (string $input, ?int $seconds) {
    expect((new DurationParser)->parse($input))->toBe($seconds);
})->with([
    ['1,5', 5400],
    ['1.5', 5400],
    ['2', 7200],
    ['1:30', 5400],
    ['0:45', 2700],
    ['90m', 5400],
    ['90 min', 5400],
    ['1h', 3600],
    ['1h30', 5400],
    ['1h 30m', 5400],
    ['1 t 30 min', 5400],
    ['2H15', 8100],
    ['1,25h', 4500],
    ['', null],
    ['abc', null],
    ['1:75', null],
    ['h', null],
]);
