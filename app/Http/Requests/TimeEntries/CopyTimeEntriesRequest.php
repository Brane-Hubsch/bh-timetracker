<?php

namespace App\Http\Requests\TimeEntries;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CopyTimeEntriesRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'entry_ids' => ['required', 'array', 'min:1', 'max:200'],
            'entry_ids.*' => ['integer', 'distinct'],
        ];
    }

    /**
     * @return array<int, int>
     */
    public function entryIds(): array
    {
        return collect($this->array('entry_ids'))
            ->map(fn (mixed $id) => is_numeric($id) ? (int) $id : 0)
            ->values()
            ->all();
    }
}
