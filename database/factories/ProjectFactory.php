<?php

namespace Database\Factories;

use App\Enums\ProjectVisibility;
use App\Models\Organization;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'client_id' => null,
            'name' => ucfirst(fake()->unique()->word()).' '.fake()->word(),
            'code' => null,
            'color' => fake()->randomElement(Project::COLORS),
            'is_billable' => true,
            'hourly_rate' => null,
            'estimate_seconds' => null,
            'visibility' => ProjectVisibility::Public,
        ];
    }

    public function private(): static
    {
        return $this->state(fn () => ['visibility' => ProjectVisibility::Private]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now()]);
    }
}
