<?php

namespace App\Http\Requests\Settings;

use App\Support\SidebarItems;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SidebarOrderRequest extends FormRequest
{
    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'order' => ['present', 'array', 'list', 'max:'.count(SidebarItems::LINKS)],
            'order.*' => ['required', 'string', 'distinct', Rule::in(SidebarItems::LINKS)],
            'import' => ['sometimes', 'boolean'],
        ];
    }

    /** @return list<string> */
    public function order(): array
    {
        return array_values(array_filter($this->array('order'), is_string(...)));
    }
}
