<?php

namespace App\Actions\Settings;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateSidebarVisibility
{
    /**
     * @param  list<string>  $legacyHiddenItems
     */
    public function handle(User $user, ?string $item, bool $visible, array $legacyHiddenItems): void
    {
        DB::transaction(function () use ($user, $item, $visible, $legacyHiddenItems): void {
            $account = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($item === null && $account->sidebar_hidden_items !== null) {
                return;
            }

            $hidden = $account->sidebar_hidden_items ?? $legacyHiddenItems;
            if ($item !== null) {
                $hidden = $visible
                    ? array_values(array_diff($hidden, [$item]))
                    : array_values(array_unique([...$hidden, $item]));
            }

            $account->sidebar_hidden_items = $hidden;
            $account->save();
        }, attempts: 3);
    }
}
