<?php

namespace App\Models;

use App\Enums\OrganizationRole;
use App\Services\Images\ImageStorage;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $user_id
 * @property OrganizationRole $role
 * @property int|null $hourly_rate Minor currency unit (öre)
 * @property Carbon|null $deactivated_at
 * @property int|null $week_starts_on
 * @property list<int>|null $working_days
 * @property int|null $workday_seconds
 * @property string|null $avatar_path
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read User $user
 */
#[Fillable(['organization_id', 'user_id', 'role', 'hourly_rate', 'deactivated_at', 'week_starts_on', 'working_days', 'workday_seconds', 'avatar_path'])]
class Membership extends Pivot
{
    public const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

    public function avatarUrl(int $size = 128): ?string
    {
        return app(ImageStorage::class)->url($this->avatar_path, $size);
    }

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'organization_members';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = true;

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    /**
     * Get the organization that the membership belongs to.
     *
     * @return BelongsTo<Organization, $this>
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the user that belongs to this membership.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => OrganizationRole::class,
            'hourly_rate' => 'integer',
            'deactivated_at' => 'datetime',
            'week_starts_on' => 'integer',
            'working_days' => 'array',
            'workday_seconds' => 'integer',
        ];
    }
}
