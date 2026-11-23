<?php

namespace App\Models;

use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Models\Concerns\Archivable;
use App\Models\Concerns\BelongsToOrganization;
use App\Models\Concerns\HasResourceSlug;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property int|null $client_id
 * @property string $name
 * @property string $slug
 * @property string|null $code
 * @property string $color Hex colour, e.g. #7c3aed
 * @property bool $is_billable
 * @property int|null $hourly_rate Minor currency unit (öre)
 * @property int|null $estimate_seconds
 * @property ProjectVisibility $visibility
 * @property Carbon|null $starts_on
 * @property Carbon|null $ends_on
 * @property string|null $notes
 * @property Carbon|null $archived_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read Client|null $client
 * @property-read Collection<int, User> $members
 */
#[Fillable([
    'organization_id', 'client_id', 'name', 'code', 'color', 'is_billable', 'hourly_rate',
    'estimate_seconds', 'visibility', 'starts_on', 'ends_on', 'notes', 'archived_at',
])]
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use Archivable, BelongsToOrganization, HasFactory, HasResourceSlug;

    /**
     * The colours offered when creating a project.
     */
    public const array COLORS = [
        '#7c3aed', '#2563eb', '#0891b2', '#059669', '#65a30d',
        '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#475569',
    ];

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_billable' => true,
        'visibility' => 'public',
    ];

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Users assigned to the project (required for private projects; optional for public ones, e.g.
     * to set a project-specific rate).
     *
     * @return BelongsToMany<User, $this, ProjectMember, 'assignment'>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')
            ->using(ProjectMember::class)
            ->as('assignment')
            ->withPivot(['id', 'hourly_rate'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<TimeEntry, $this>
     */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /**
     * Total reported time on the project (all members, all time).
     */
    public function consumedSeconds(): int
    {
        return (int) $this->timeEntries()->sum('duration_seconds');
    }

    /**
     * Whether the user may see the project and report time on it.
     */
    public function isAccessibleBy(User $user): bool
    {
        $role = $user->organizationRole($this->organization);

        if ($role === null) {
            return false;
        }

        if ($role->isAtLeast(OrganizationRole::Admin) || $this->visibility === ProjectVisibility::Public) {
            return true;
        }

        return $this->members()->whereKey($user->id)->exists();
    }

    /**
     * Projects the user may see: all for owners/admins, otherwise public ones and those the user is
     * assigned to.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function accessibleBy(Builder $query, User $user, Organization $organization): void
    {
        if ($user->organizationRole($organization)?->isAtLeast(OrganizationRole::Admin)) {
            return;
        }

        $query->where(fn (Builder $query) => $query
            ->where('visibility', ProjectVisibility::Public->value)
            ->orWhereHas('members', fn (Builder $query) => $query->whereKey($user->id)));
    }

    /**
     * Case-insensitive search on name, code and client name.
     *
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function search(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);

        if ($term === '') {
            return;
        }

        $query->where(fn (Builder $query) => $query
            ->whereLike('name', "%{$term}%")
            ->orWhereLike('code', "%{$term}%")
            ->orWhereHas('client', fn (Builder $query) => $query->whereLike('name', "%{$term}%")));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_billable' => 'boolean',
            'hourly_rate' => 'integer',
            'estimate_seconds' => 'integer',
            'visibility' => ProjectVisibility::class,
            'starts_on' => 'date',
            'ends_on' => 'date',
            'archived_at' => 'datetime',
        ];
    }
}
