<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Database\Factories\HolidayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A day off for everyone in an organization (a public holiday or one of its own), which doesn't
 * count as a working day. One per date and organization.
 *
 * @property int $id
 * @property int $organization_id
 * @property Carbon $date
 * @property string $name
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 */
#[Fillable(['organization_id', 'date', 'name'])]
class Holiday extends Model
{
    /** @use HasFactory<HolidayFactory> */
    use BelongsToOrganization, HasFactory;

    public const int MAX_NAME_LENGTH = 100;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }
}
