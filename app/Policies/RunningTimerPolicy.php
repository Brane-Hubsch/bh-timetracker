<?php

namespace App\Policies;

use App\Models\RunningTimer;
use App\Models\User;

/**
 * Everyone runs and stops only their own timer, in an organization they are an active member of.
 */
class RunningTimerPolicy
{
    public function update(User $user, RunningTimer $timer): bool
    {
        return $timer->user_id === $user->id && $user->belongsToOrganization($timer->organization);
    }

    public function delete(User $user, RunningTimer $timer): bool
    {
        return $this->update($user, $timer);
    }
}
