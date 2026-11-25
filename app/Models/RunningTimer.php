<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Models\Scopes\OrganizationScope;
use Carbon\CarbonImmutable;
use Database\Factories\RunningTimerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A timer someone is running. Each person has at most one, in one of their organizations, and it
 * becomes a time entry when stopped (StopTimer). The project may be chosen later, but is needed to
 * stop it.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $user_id
 * @property int|null $project_id
 * @property string|null $description
 * @property bool|null $is_billable Null follows the project
 * @property array<int, string>|null $tags Tag names
 * @property CarbonImmutable $started_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read User $user
 * @property-read Project|null $project
 */
#[Fillable(['organization_id', 'user_id', 'project_id', 'description', 'is_billable', 'tags', 'started_at'])]
class RunningTimer extends Model
{
    /** @use HasFactory<RunningTimerFactory> */
    use BelongsToOrganization, HasFactory;

    /** A timer running longer than this asks for the end time when stopped. */
    public const int LONG_SECONDS = 10 * 3600;

    /**
     * The person's running timer, in any organization they are an active member of.
     */
    public static function runningFor(User $user): ?self
    {
        return self::query()
            ->withoutGlobalScope(OrganizationScope::class)
            ->where('user_id', $user->id)
            ->whereIn('organization_id', $user->organizations()->select('organizations.id'))
            ->with(['organization', 'project.client'])
            ->first();
    }

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
        return $this->belongsTo(Project::class)->withoutGlobalScope(OrganizationScope::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_billable' => 'boolean',
            'tags' => 'array',
            'started_at' => 'immutable_datetime',
        ];
    }
}
