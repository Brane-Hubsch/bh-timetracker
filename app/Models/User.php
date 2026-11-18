<?php

namespace App\Models;

use App\Concerns\HasOrganizations;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property string|null $google_id
 * @property string|null $avatar_url
 * @property string $locale
 * @property string $timezone
 * @property string|null $remember_token
 * @property int|null $current_organization_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization|null $currentOrganization
 * @property-read Collection<int, Organization> $ownedOrganizations
 * @property-read Collection<int, Membership> $organizationMemberships
 * @property-read Collection<int, Organization> $organizations
 */
#[Fillable(['name', 'email', 'password', 'google_id', 'avatar_url', 'locale', 'timezone', 'current_organization_id'])]
#[Hidden(['password', 'google_id', 'remember_token'])]
class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasOrganizations, Notifiable, PasskeyAuthenticatable;

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
        ];
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
