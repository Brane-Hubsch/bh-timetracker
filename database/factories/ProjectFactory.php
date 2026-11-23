<?php

namespace Database\Factories;

use App\Enums\ProjectVisibility;
use App\Models\Organization;
use App\Models\Project;
use App\Support\ResourceSlug;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;

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
            'slug' => fn (array $attributes) => ResourceSlug::available(
                DB::table('projects')->where('organization_id', $attributes['organization_id']),
                $attributes['name'],
                'project',
            ),
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
