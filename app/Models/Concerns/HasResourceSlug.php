<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;

/** @mixin Model */
trait HasResourceSlug
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        if ($field === null && (is_int($value) || (is_string($value) && ctype_digit($value)))) {
            $field = $this->getKeyName();
            // Keep bookmarked numeric links, including leading zeroes, within the bigint range.
            $value = is_int($value) ? $value : (filter_var(ltrim($value, '0'), FILTER_VALIDATE_INT) ?: 0);
        }

        return parent::resolveRouteBindingQuery($query, $value, $field);
    }
}
