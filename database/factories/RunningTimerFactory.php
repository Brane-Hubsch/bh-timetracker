<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Project;
use App\Models\RunningTimer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RunningTimer>
 */
class RunningTimerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory(),
            'project_id' => null,
            'description' => null,
            'is_billable' => null,
            'tags' => null,
            'started_at' => now()->subHour(),
        ];
    }

    /**
     * For the given member, on the given project.
     */
    public function by(User $user, ?Project $project = null, ?Organization $organization = null): static
    {
        return $this->state(fn () => [
            'user_id' => $user->id,
            'organization_id' => $project->organization_id ?? $organization?->id,
            'project_id' => $project?->id,
        ]);
    }
}
