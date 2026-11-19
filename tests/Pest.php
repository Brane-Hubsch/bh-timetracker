<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/*
| Clockify import: CSV in the format of Clockify's user data export.
*/

const CLOCKIFY_HEADER = '"Project","Client","Description","Task","User","Group","Email","Tags","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Date of creation"';

/**
 * @param  array<int, array<int, string>>  $rows
 */
function clockifyCsv(array $rows, string $header = CLOCKIFY_HEADER, string $delimiter = ','): string
{
    $lines = [$header];

    foreach ($rows as $row) {
        $lines[] = implode($delimiter, array_map(fn (string $value) => '"'.str_replace('"', '""', $value).'"', $row));
    }

    return implode("\n", $lines)."\n";
}

/**
 * A row in the user data export format: project, client, description, task, user, email, tags, start, end.
 *
 * @return array<int, string>
 */
function clockifyRow(string $project, ?string $client, string $email, string $startDate, string $startTime, string $endDate, string $endTime, string $description = '', string $task = '', string $tags = '', string $user = 'Anna Andersson'): array
{
    return [$project, $client ?? '', $description, $task, $user, '', $email, $tags, $startDate, $startTime, $endDate, $endTime, '', '', ''];
}
