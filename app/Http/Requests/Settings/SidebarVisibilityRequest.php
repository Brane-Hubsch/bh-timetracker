<?php

namespace App\Http\Requests\Settings;

use App\Support\SidebarItems;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SidebarVisibilityRequest extends FormRequest
{
    /**
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'item' => ['required_with:visible', 'string', Rule::in(SidebarItems::ALL)],
            'visible' => ['required_with:item', 'boolean'],
            'legacy_hidden_items' => [Rule::when(! $this->has('item'), 'present'), 'array', 'list', 'max:'.count(SidebarItems::ALL)],
            'legacy_hidden_items.*' => ['required', 'string', 'distinct', Rule::in(SidebarItems::ALL)],
        ];
    }

    public function item(): ?string
    {
        return $this->has('item') ? $this->string('item')->value() : null;
    }

    /**
     * @return list<string>
     */
    public function legacyHiddenItems(): array
    {
        return array_values(array_filter($this->array('legacy_hidden_items'), is_string(...)));
    }
}
