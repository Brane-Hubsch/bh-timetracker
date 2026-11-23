<?php

namespace Database\Factories;

use App\Enums\AbsenceType;
use App\Models\Absence;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Absence>
 */
class AbsenceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory(),
            'type' => AbsenceType::Vacation,
            'starts_on' => '2026-11-23',
            'ends_on' => '2026-11-25',
            'seconds_per_day' => null,
            'note' => null,
        ];
    }

    /**
     * For the given member of the given organization.
     */
    public function by(User $user, Organization $organization): static
    {
        return $this->state(fn () => ['user_id' => $user->id, 'organization_id' => $organization->id]);
    }
}
