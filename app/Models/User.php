<?php

namespace App\Models;

use App\Concerns\HasOrganizations;
use App\Services\Images\ImageStorage;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Appends;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Passport\Contracts\OAuthenticatable;
use Laravel\Passport\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property string|null $google_id
 * @property string|null $avatar_url Profile picture from Google
 * @property string|null $avatar_path Uploaded profile picture (directory in ImageStorage)
 * @property-read string|null $avatar Uploaded picture, else the Google one
 * @property string $locale
 * @property string $timezone
 * @property string|null $remember_token
 * @property int|null $current_organization_id
 * @property list<string>|null $sidebar_hidden_items
 * @property list<string>|null $sidebar_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization|null $currentOrganization
 * @property-read Collection<int, Organization> $ownedOrganizations
 * @property-read Collection<int, Membership> $organizationMemberships
 * @property-read Collection<int, Organization> $organizations
 */
#[Fillable(['name', 'email', 'password', 'google_id', 'avatar_url', 'avatar_path', 'locale', 'timezone', 'current_organization_id'])]
#[Hidden(['password', 'google_id', 'remember_token', 'avatar_path', 'sidebar_hidden_items', 'sidebar_order'])]
#[Appends(['avatar'])]
class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail, OAuthenticatable, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasOrganizations, Notifiable, PasskeyAuthenticatable;

    /**
     * Mirrors the column defaults so freshly created users have them before a reload.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'locale' => 'sv',
        'timezone' => 'Europe/Stockholm',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'sidebar_hidden_items' => 'array',
            'sidebar_order' => 'array',
        ];
    }

    /**
     * The profile picture to show (128 px): the uploaded one, else the one from Google.
     *
     * @return Attribute<string|null, never>
     */
    protected function avatar(): Attribute
    {
        return Attribute::get(fn (): ?string => app(ImageStorage::class)->url($this->avatar_path) ?? $this->avatar_url);
    }

    /**
     * Prefer the team's upload when displaying a member in that organization.
     */
    public function avatarForMembership(?Membership $membership = null): ?string
    {
        $pivot = $this->getRelations()['pivot'] ?? null;
        $membership ??= $pivot instanceof Membership ? $pivot : null;

        return $membership?->avatarUrl() ?? $this->avatar;
    }

    /**
     * Emails and notifications use the user's language.
     */
    public function preferredLocale(): string
    {
        return $this->locale ?? config()->string('app.locale');
    }

    /**
     * Get the magic sign-in links issued to the user.
     *
     * @return HasMany<MagicLink, $this>
     */
    public function magicLinks(): HasMany
    {
        return $this->hasMany(MagicLink::class);
    }

    /**
     * Whether the user has registered at least one passkey.
     */
    public function hasPasskeys(): bool
    {
        return $this->passkeys()->exists();
    }
}
