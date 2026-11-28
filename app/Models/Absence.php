<?php

namespace App\Models;

use App\Enums\AbsenceType;
use App\Models\Concerns\BelongsToOrganization;
use Database\Factories\AbsenceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * A member's absence over one or more days (both dates included). Weekends and the organization's
 * holidays in the period don't count. A full day counts as the organization's working day.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $user_id
 * @property AbsenceType $type
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property int|null $seconds_per_day Null for full working days
 * @property string|null $note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read User $user
 */
#[Fillable(['organization_id', 'user_id', 'type', 'starts_on', 'ends_on', 'seconds_per_day', 'note'])]
class Absence extends Model
{
    /** @use HasFactory<AbsenceFactory> */
    use BelongsToOrganization, HasFactory, SoftDeletes;

    /** Longest period of one absence, in days. */
    public const int MAX_DAYS = 366;

    public const int MAX_NOTE_LENGTH = 500;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => AbsenceType::class,
            'starts_on' => 'date',
            'ends_on' => 'date',
            'seconds_per_day' => 'integer',
        ];
    }
}
