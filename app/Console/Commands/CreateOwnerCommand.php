<?php

namespace App\Console\Commands;

use App\Actions\Auth\SendMagicLink;
use App\Actions\Organizations\CreateOrganization;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Bootstraps the first owner in an environment without open registration: creates the user and
 * organization and emails a sign-in link. Everyone else is invited from the app.
 */
#[Signature('app:create-owner {email} {name} {organization}')]
#[Description('Create a user who owns a new organization and email them a sign-in link')]
class CreateOwnerCommand extends Command
{
    public function handle(CreateOrganization $createOrganization, SendMagicLink $sendMagicLink): int
    {
        $input = [
            'email' => mb_strtolower($this->stringArgument('email')),
            'name' => $this->stringArgument('name'),
            'organization' => $this->stringArgument('organization'),
        ];

        $validator = Validator::make($input, [
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['required', 'string', 'max:255'],
            'organization' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($input, $createOrganization) {
            $user = User::create(['name' => $input['name'], 'email' => $input['email']]);
            $user->forceFill(['email_verified_at' => now()])->save();

            $createOrganization->handle($user, $input['organization']);

            return $user;
        });

        $sendMagicLink->handle($user);

        $this->info("Created {$user->email} as owner of \"{$input['organization']}\" and emailed a sign-in link.");

        return self::SUCCESS;
    }

    private function stringArgument(string $name): string
    {
        $value = $this->argument($name);

        return is_string($value) ? trim($value) : '';
    }
}
