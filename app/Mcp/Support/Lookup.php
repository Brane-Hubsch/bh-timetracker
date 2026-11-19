<?php

namespace App\Mcp\Support;

use App\Enums\OrganizationPermission;
use App\Models\Client;
use App\Models\Project;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Finds projects, clients and members by id or by (part of) their name, within what the user may
 * see. Ambiguous or unknown names give an error that lists the candidates, so the AI can ask the
 * user or retry with an id.
 */
class Lookup
{
    /** Candidates listed in an ambiguity error. */
    private const int MAX_CANDIDATES = 10;

    /**
     * @param  bool  $activeOnly  only projects time can be reported on (not archived, client not archived)
     */
    public function project(McpContext $context, mixed $reference, string $field = 'project', bool $activeOnly = false): Project
    {
        $query = Project::query()
            ->accessibleBy($context->user, $context->organization)
            ->with('client')
            ->when($activeOnly, fn (Builder $query) => $query
                ->active()
                ->where(fn (Builder $query) => $query
                    ->whereNull('client_id')
                    ->orWhereHas('client', fn (Builder $query) => $query->whereNull('archived_at'))));

        return $this->find($query->get(), $reference, $field, 'project', fn (Project $project) => [
            $project->name,
            $project->code ?? '',
            $project->client->name ?? '',
        ], fn (Project $project) => sprintf(
            '%s%s (id %d)',
            $project->name,
            $project->client ? ' · '.$project->client->name : '',
            $project->id,
        ));
    }

    public function client(McpContext $context, mixed $reference, string $field = 'client'): Client
    {
        $query = Client::query()->when(
            ! $context->can(OrganizationPermission::ManageClients),
            fn (Builder $query) => $query->whereIn(
                'id',
                Project::query()->accessibleBy($context->user, $context->organization)->whereNotNull('client_id')->select('client_id'),
            ),
        );

        return $this->find($query->get(), $reference, $field, 'client', fn (Client $client) => [
            $client->name,
            $client->organization_number ?? '',
        ], fn (Client $client) => sprintf('%s (id %d)', $client->name, $client->id));
    }

    /**
     * A tag in the organization, by id or name (case-insensitive).
     */
    public function tag(McpContext $context, mixed $reference, string $field = 'tag'): Tag
    {
        return $this->find(
            Tag::query()->forOrganization($context->organization)->orderBy('name')->get(),
            $reference,
            $field,
            'tag',
            fn (Tag $tag) => [$tag->name],
            fn (Tag $tag) => sprintf('%s (id %d)', $tag->name, $tag->id),
        );
    }

    /**
     * An active member of the organization, by id, email or name. Only owners and admins may refer
     * to anyone but themselves.
     */
    public function member(McpContext $context, mixed $reference, string $field = 'member'): User
    {
        $members = $context->organization->members()->wherePivotNull('deactivated_at')->orderBy('name')->get();

        $member = $this->find($members, $reference, $field, 'member', fn (User $user) => [
            $user->name,
            $user->email,
        ], fn (User $user) => sprintf('%s <%s> (id %d)', $user->name, $user->email, $user->id));

        if (! $member->is($context->user) && ! $context->can(OrganizationPermission::ManageTeamTime)) {
            throw ValidationException::withMessages([$field => 'Only owners and admins can see or report time for other members.']);
        }

        return $member;
    }

    /**
     * @template TModel of Model
     *
     * @param  Collection<int, TModel>  $candidates
     * @param  callable(TModel): array<int, string>  $searchable
     * @param  callable(TModel): string  $describe
     * @return TModel
     */
    private function find(Collection $candidates, mixed $reference, string $field, string $kind, callable $searchable, callable $describe): Model
    {
        if (is_int($reference) || (is_string($reference) && ctype_digit($reference))) {
            foreach ($candidates as $candidate) {
                if ($candidate->getKey() === (int) $reference) {
                    return $candidate;
                }
            }

            throw ValidationException::withMessages([$field => "No {$kind} with id {$reference} that you can access."]);
        }

        $term = is_string($reference) ? mb_strtolower(trim($reference)) : '';

        if ($term === '') {
            throw ValidationException::withMessages([$field => "Give the {$kind} as an id or a name."]);
        }

        // Exact name (or code/email) first, then every word of the reference somewhere in the
        // name, client name or code ("acme webbshop").
        $words = preg_split('/\s+/', $term) ?: [];
        $exact = [];
        $partial = [];

        foreach ($candidates as $candidate) {
            $fields = array_map('mb_strtolower', $searchable($candidate));
            $haystack = implode(' ', $fields);

            if (in_array($term, $fields, true)) {
                $exact[] = $candidate;
            } elseif (array_all($words, fn (string $word) => str_contains($haystack, $word))) {
                $partial[] = $candidate;
            }
        }

        $matches = $exact !== [] ? $exact : $partial;

        if (count($matches) === 1) {
            return $matches[0];
        }

        if ($matches === []) {
            throw ValidationException::withMessages([$field => sprintf('No %s matches "%s".', $kind, $reference)]);
        }

        $listed = [];

        foreach (array_slice($matches, 0, self::MAX_CANDIDATES) as $match) {
            $listed[] = $describe($match);
        }

        throw ValidationException::withMessages([$field => sprintf(
            'The %s "%s" matches %d %ss: %s. Ask the user which one, or pass the id.',
            $kind,
            $reference,
            count($matches),
            $kind,
            implode('; ', $listed),
        )]);
    }
}
