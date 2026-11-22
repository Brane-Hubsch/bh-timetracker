<?php

namespace App\Support;

class WebsiteUrl
{
    /** @return list<string> */
    public static function rules(): array
    {
        return ['string', 'max:2048', 'url:http,https'];
    }

    public static function normalize(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (str_starts_with($value, '//')) {
            return 'https:'.$value;
        }

        return preg_match('/^[a-z][a-z\d+.-]*:/i', $value) === 1 ? $value : 'https://'.$value;
    }
}
