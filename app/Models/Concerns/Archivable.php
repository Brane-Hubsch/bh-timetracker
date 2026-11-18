<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * For models with an `archived_at` column. Archived records are hidden from pickers but kept for
 * reports.
 *
 * @mixin Model
 */
trait Archivable
{
    public function isArchived(): bool
    {
        return $this->getAttribute('archived_at') !== null;
    }

    /**
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull($this->qualifyColumn('archived_at'));
    }

    /**
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function archived(Builder $query): void
    {
        $query->whereNotNull($this->qualifyColumn('archived_at'));
    }
}
