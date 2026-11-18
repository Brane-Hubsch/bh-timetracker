<?php

use App\Enums\OrganizationRole;
use Illuminate\Support\Facades\File;

/**
 * Every UI string goes through t()/tc() (React) or __() (PHP) with an English key. This makes sure
 * each key has a Swedish translation in lang/sv.json, so nothing shows up untranslated.
 *
 * Legacy shadcn components in resources/js/components/ui (removed in phase 1) are not checked.
 */
function translationKeysUsedInCode(): array
{
    $patterns = [
        'js' => '/\bt[c]?\(\s*([\'"])((?:\\\\.|(?!\1).)*)\1/s',
        'layout' => '/\b(?:title|description):\s*([\'"])((?:\\\\.|(?!\1).)*)\1/s',
        'php' => '/__\(\s*([\'"])((?:\\\\.|(?!\1).)*)\1/s',
    ];

    $files = collect([
        ...File::allFiles(resource_path('js')),
        ...File::allFiles(app_path()),
    ])->reject(fn (SplFileInfo $file) => preg_match('#resources/js/(actions|routes|wayfinder|components/ui)/#', $file->getPathname()));

    $keys = [];

    foreach ($files as $file) {
        $contents = $file->getContents();
        $isScript = in_array($file->getExtension(), ['ts', 'tsx'], true);

        foreach ($isScript ? ['js', 'layout'] : ['php'] as $type) {
            preg_match_all($patterns[$type], $contents, $matches);

            foreach ($matches[2] as $key) {
                if ($key !== '') {
                    $keys[stripcslashes($key)] = $file->getRelativePathname();
                }
            }
        }
    }

    return $keys;
}

it('has a Swedish translation for every key used in the code', function () {
    $swedish = json_decode(File::get(lang_path('sv.json')), true, flags: JSON_THROW_ON_ERROR);

    $missing = array_diff_key(translationKeysUsedInCode(), $swedish);

    expect($missing)->toBeEmpty();
});

it('translates role labels', function () {
    app()->setLocale('sv');

    expect(OrganizationRole::Owner->label())->toBe('Ägare')
        ->and(OrganizationRole::Member->label())->toBe('Medlem');
});
