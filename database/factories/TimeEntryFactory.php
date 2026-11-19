<?php

namespace Database\Factories;

use App\Enums\TimeEntrySource;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TimeEntry>
 */
class TimeEntryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = CarbonImmutable::now('UTC')->startOfHour()->subHours(fake()->numberBetween(1, 48));
        $end = $start->addMinutes(30 * fake()->numberBetween(1, 6));

        return [
            'project_id' => Project::factory(),
            'organization_id' => fn (array $attributes) => Project::query()->withoutGlobalScopes()->whereKey($attributes['project_id'])->value('organization_id'),
            'user_id' => User::factory(),
            'description' => fake()->optional()->sentence(4),
            'started_at' => $start,
            'ended_at' => $end,
            'duration_seconds' => fn (array $attributes) => (int) CarbonImmutable::parse($attributes['started_at'])->diffInSeconds(CarbonImmutable::parse($attributes['ended_at'])),
            'is_billable' => true,
            'hourly_rate' => null,
            'source' => TimeEntrySource::Web,
        ];
    }

    /**
     * An entry for the given user on the given project.
     */
    public function by(User $user, Project $project): static
    {
        return $this->state(fn () => [
            'user_id' => $user->id,
            'project_id' => $project->id,
            'organization_id' => $project->organization_id,
        ]);
    }

    /**
     * Set the period (UTC).
     */
    public function between(string $start, string $end): static
    {
        return $this->state(fn () => [
            'started_at' => CarbonImmutable::parse($start, 'UTC'),
            'ended_at' => CarbonImmutable::parse($end, 'UTC'),
        ]);
    }
}
