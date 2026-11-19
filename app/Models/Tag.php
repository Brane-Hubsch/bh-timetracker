<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Database\Factories\TagFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * A label on time entries (e.g. "Möte", "Buggfix"), shared within an organization. Names are unique
 * per organization, compared case-insensitively.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read Collection<int, TimeEntry> $timeEntries
 * @property-read int|null $time_entries_count Set by withCount('timeEntries').
 */
#[Fillable(['organization_id', 'name'])]
class Tag extends Model
{
    /** @use HasFactory<TagFactory> */
    use BelongsToOrganization, HasFactory;

    public const int MAX_NAME_LENGTH = 50;

    /** Most tags on one time entry. */
    public const int MAX_PER_ENTRY = 10;

    /**
     * @return BelongsToMany<TimeEntry, $this>
     */
    public function timeEntries(): BelongsToMany
    {
        return $this->belongsToMany(TimeEntry::class);
    }

    /**
     * The name as tags are compared: trimmed, single spaces, lower case (multibyte safe, unlike
     * SQLite's lower()).
     */
    public static function normalize(string $name): string
    {
        return mb_strtolower(self::clean($name));
    }

    /**
     * The name as it is stored: trimmed with single spaces.
     */
    public static function clean(string $name): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $name));
    }
}
