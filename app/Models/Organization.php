<?php

namespace App\Models;

use App\Concerns\GeneratesUniqueOrganizationSlugs;
use App\Enums\OrganizationRole;
use App\Services\Images\ImageStorage;
use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string $currency
 * @property int|null $default_hourly_rate
 * @property int $week_starts_on
 * @property string $timezone
 * @property bool $team_enabled
 * @property int $workday_seconds Length of a full working day (a full day of absence counts as this)
 * @property string|null $logo_path Uploaded logo (directory in ImageStorage)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Collection<int, OrganizationInvitation> $invitations
 * @property-read Collection<int, Membership> $memberships
 * @property-read Collection<int, User> $members
 * @property-read Collection<int, Client> $clients
 * @property-read Collection<int, Project> $projects
 * @property-read Collection<int, Holiday> $holidays
 */
#[Fillable(['name', 'slug', 'currency', 'default_hourly_rate', 'week_starts_on', 'timezone', 'logo_path', 'workday_seconds', 'team_enabled'])]
class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use GeneratesUniqueOrganizationSlugs, HasFactory, SoftDeletes;

    /**
     * Mirrors the column defaults so freshly created organizations have them before a reload.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'currency' => 'SEK',
        'week_starts_on' => 1,
        'timezone' => 'Europe/Stockholm',
        'workday_seconds' => 28800,
        'team_enabled' => false,
    ];

    /**
     * Bootstrap the model and its traits.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Organization $organization) {
            if (empty($organization->slug)) {
                $organization->slug = static::generateUniqueOrganizationSlug($organization->name);
            }
        });

        static::updating(function (Organization $organization) {
            if ($organization->isDirty('name')) {
                $organization->slug = static::generateUniqueOrganizationSlug($organization->name, $organization->id);
            }
        });
    }

    /**
     * Get the organization owner.
     */
    public function owner(): ?Model
    {
        return $this->members()
            ->wherePivot('role', OrganizationRole::Owner->value)
            ->first();
    }

    /**
     * Get all members of this organization.
     *
     * @return BelongsToMany<User, $this, Membership, 'pivot'>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_members', 'organization_id', 'user_id')
            ->using(Membership::class)
            ->withPivot(['role', 'hourly_rate', 'deactivated_at', 'week_starts_on', 'working_days', 'workday_seconds', 'avatar_path'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<Client, $this>
     */
    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    /**
     * @return HasMany<Project, $this>
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    /**
     * Get all memberships for this organization.
     *
     * @return HasMany<Membership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /**
     * Days off for everyone in the organization.
     *
     * @return HasMany<Holiday, $this>
     */
    public function holidays(): HasMany
    {
        return $this->hasMany(Holiday::class);
    }

    /**
     * Get all invitations for this organization.
     *
     * @return HasMany<OrganizationInvitation, $this>
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(OrganizationInvitation::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'default_hourly_rate' => 'integer',
            'week_starts_on' => 'integer',
            'workday_seconds' => 'integer',
            'team_enabled' => 'boolean',
        ];
    }

    /**
     * Get the route key for the model.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * URL of the logo in the size closest to the requested one, or null without a logo.
     */
    public function logoUrl(int $size = 128): ?string
    {
        return app(ImageStorage::class)->url($this->logo_path, $size);
    }
}
