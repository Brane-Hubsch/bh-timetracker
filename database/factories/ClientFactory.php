<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Organization;
use App\Support\ResourceSlug;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name' => fake()->unique()->company(),
            'slug' => fn (array $attributes) => ResourceSlug::available(
                DB::table('clients')->where('organization_id', $attributes['organization_id']),
                $attributes['name'],
                'client',
            ),
            'organization_number' => fake()->numerify('######-####'),
            'email' => fake()->companyEmail(),
            'notes' => null,
        ];
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now()]);
    }
}
