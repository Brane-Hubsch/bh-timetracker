<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Carbon;

/**
 * A user assigned to a project, optionally with a project-specific hourly rate.
 *
 * @property int $id
 * @property int $project_id
 * @property int $user_id
 * @property int|null $hourly_rate Minor currency unit (öre)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['project_id', 'user_id', 'hourly_rate'])]
class ProjectMember extends Pivot
{
    protected $table = 'project_members';

    public $incrementing = true;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'hourly_rate' => 'integer',
        ];
    }
}
