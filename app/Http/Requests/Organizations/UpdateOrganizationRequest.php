<?php

namespace App\Http\Requests\Organizations;

use App\Rules\OrganizationName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateOrganizationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('organization'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', new OrganizationName],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            // Stored in the minor currency unit (öre).
            'default_hourly_rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'week_starts_on' => ['required', 'integer', 'between:1,7'],
            'timezone' => ['required', 'string', 'timezone:all'],
        ];
    }
}
