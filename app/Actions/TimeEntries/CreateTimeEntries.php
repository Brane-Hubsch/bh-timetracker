<?php

namespace App\Actions\TimeEntries;

use App\Data\TimeEntryData;
use App\Models\Organization;
use App\Models\TimeEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateTimeEntries
{
    public function __construct(private readonly CreateTimeEntry $createTimeEntry)
    {
        //
    }

    /**
     * Create several entries at once (e.g. "copy previous week", or "fill my week" over MCP). All or
     * nothing: if one entry is invalid, none are created and the error names its position.
     *
     * @param  array<int, TimeEntryData>  $entries
     * @return Collection<int, TimeEntry>
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, array $entries): Collection
    {
        return DB::transaction(function () use ($organization, $entries) {
            $created = new Collection;

            foreach (array_values($entries) as $index => $data) {
                try {
                    $created->push($this->createTimeEntry->handle($organization, $data));
                } catch (ValidationException $exception) {
                    throw ValidationException::withMessages(collect($exception->errors())
                        ->mapWithKeys(fn (array $messages, string $key) => ["entries.{$index}.{$key}" => $messages])
                        ->all());
                }
            }

            return $created;
        });
    }
}
