<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ResourceSlug
{
    public static function available(Builder $organizationRows, string $name, string $fallback): string
    {
        $base = rtrim(substr(Str::slug($name), 0, 200), '-');
        $base = match (true) {
            $base === '' => $fallback,
            ctype_digit($base) => $fallback.'-'.$base,
            default => $base,
        };

        $slug = $base;

        for ($suffix = 2; (clone $organizationRows)->where('slug', $slug)->exists(); $suffix++) {
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }

    /**
     * @template TModel of Model
     *
     * @param  TModel  $model
     * @return TModel
     */
    public static function create(Model $model, int $organizationId, string $name, string $fallback): Model
    {
        $connection = $model->getConnection();
        $organizationRows = $connection->table($model->getTable())->where('organization_id', $organizationId);

        while (true) {
            $slug = self::available($organizationRows, $name, $fallback);

            try {
                // The savepoint also keeps an enclosing import transaction usable after a collision.
                return $connection->transaction(function () use ($model, $slug) {
                    $model->setAttribute('slug', $slug);
                    $model->save();

                    return $model;
                }, attempts: 3);
            } catch (UniqueConstraintViolationException $exception) {
                if (! (clone $organizationRows)->where('slug', $slug)->exists()) {
                    throw $exception;
                }
            }
        }
    }

    /**
     * Call after authorizing the resource so a legacy address cannot disclose its slug.
     */
    public static function redirect(Request $request, string $routeName, string $parameter, string $slug): ?RedirectResponse
    {
        if ($request->route()?->originalParameter($parameter) === $slug) {
            return null;
        }

        $url = route($routeName, [$parameter => $slug]);
        $query = $request->server('QUERY_STRING');

        return redirect()->to(is_string($query) && $query !== '' ? $url.'?'.$query : $url);
    }
}
