<?php

namespace App\Actions\Holidays;

use App\Models\Holiday;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

class CreateHoliday
{
    /**
     * Add a day off for the organization. There is one holiday per date.
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, CarbonImmutable $date, string $name): Holiday
    {
        $name = trim($name);

        if ($name === '' || mb_strlen($name) > Holiday::MAX_NAME_LENGTH) {
            throw ValidationException::withMessages(['name' => __('A holiday needs a name of at most :max characters.', ['max' => Holiday::MAX_NAME_LENGTH])]);
        }

        if (Holiday::query()->forOrganization($organization)->whereDate('date', $date->toDateString())->exists()) {
            throw ValidationException::withMessages(['date' => __('There is already a holiday on this day.')]);
        }

        return Holiday::create([
            'organization_id' => $organization->id,
            'date' => $date->toDateString(),
            'name' => $name,
        ]);
    }
}
