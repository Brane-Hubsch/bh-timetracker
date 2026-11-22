<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use App\Models\Concerns\BelongsToOrganization;
use App\Services\Images\ImageStorage;
use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property string|null $website
 * @property string|null $organization_number
 * @property string|null $email
 * @property string|null $notes
 * @property Carbon|null $archived_at
 * @property string|null $logo_path Uploaded logo (directory in ImageStorage)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read Collection<int, Project> $projects
 */
#[Fillable(['organization_id', 'name', 'website', 'organization_number', 'email', 'notes', 'archived_at', 'logo_path'])]
class Client extends Model
{
    /** @use HasFactory<ClientFactory> */
    use Archivable, BelongsToOrganization, HasFactory;

    /**
     * @return HasMany<Project, $this>
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    /**
     * Case-insensitive search on name, organization number and email.
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
            ->orWhereLike('organization_number', "%{$term}%")
            ->orWhereLike('email', "%{$term}%"));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    /**
     * URL of the logo in the size closest to the requested one, or null without a logo.
     */
    public function logoUrl(int $size = 128): ?string
    {
        return app(ImageStorage::class)->url($this->logo_path, $size);
    }
}
