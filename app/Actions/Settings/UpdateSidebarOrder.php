<?php

namespace App\Actions\Settings;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateSidebarOrder
{
    /** @param list<string> $order */
    public function handle(User $user, array $order, bool $onlyIfUnset = false): void
    {
        DB::transaction(function () use ($user, $order, $onlyIfUnset): void {
            $account = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($onlyIfUnset && $account->sidebar_order !== null) {
                return;
            }

            $account->sidebar_order = $order;
            $account->save();
        }, attempts: 3);
    }
}
