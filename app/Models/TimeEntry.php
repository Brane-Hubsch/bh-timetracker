<?php

namespace App\Models;

use App\Enums\TimeEntrySource;
use App\Models\Concerns\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Database\Factories\TimeEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Reported time. Timestamps are UTC; an entry belongs to the day it starts on (in the user's time
 * zone) even when it runs past midnight.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $user_id
 * @property int $project_id
 * @property string|null $description
 * @property CarbonImmutable $started_at
 * @property CarbonImmutable $ended_at
 * @property int $duration_seconds
 * @property bool $is_billable
 * @property int|null $hourly_rate Snapshot, minor currency unit (öre)
 * @property TimeEntrySource $source
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Organization $organization
 * @property-read User $user
 * @property-read Project $project
 */
#[Fillable([
    'organization_id', 'user_id', 'project_id', 'description', 'started_at', 'ended_at',
    'duration_seconds', 'is_billable', 'hourly_rate', 'source',
])]
class TimeEntry extends Model
{
    /** @use HasFactory<TimeEntryFactory> */
    use BelongsToOrganization, HasFactory, SoftDeletes;

    /** Longest allowed entry. */
    public const int MAX_DURATION_SECONDS = 24 * 3600;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Entries starting in [from, to).
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function startingBetween(Builder $query, CarbonImmutable $from, CarbonImmutable $to): void
    {
        $query->where('started_at', '>=', $from->utc())->where('started_at', '<', $to->utc());
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'immutable_datetime',
            'ended_at' => 'immutable_datetime',
            'duration_seconds' => 'integer',
            'is_billable' => 'boolean',
            'hourly_rate' => 'integer',
            'source' => TimeEntrySource::class,
        ];
    }
}
