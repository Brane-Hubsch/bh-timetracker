<?php

namespace Database\Factories;

use App\Models\Holiday;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Holiday>
 */
class HolidayFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'date' => fake()->unique()->dateTimeBetween('2026-01-01', '2027-12-31')->format('Y-m-d'),
            'name' => fake()->words(2, true),
        ];
    }
}
