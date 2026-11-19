<?php

namespace App\Http\Requests\Auth;

use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request. The email may already exist: then a
     * sign-in link is sent instead (see RegisterUser).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => $this->nameRules(),
            'email' => ['required', 'string', 'email', 'max:255'],
        ];
    }

    public function userName(): string
    {
        return $this->string('name')->trim()->value();
    }

    public function email(): string
    {
        return $this->string('email')->trim()->value();
    }
}
