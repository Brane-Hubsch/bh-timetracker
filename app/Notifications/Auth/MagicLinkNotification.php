<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class MagicLinkNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $url, public int $lifetimeMinutes)
    {
        //
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('Your sign-in link for :app', ['app' => config()->string('app.name')]))
            ->line(__('Use the button below to sign in. The link works once and expires in :minutes minutes.', [
                'minutes' => $this->lifetimeMinutes,
            ]))
            ->action(__('Sign in'), $this->url)
            ->line(__('If you did not ask for this email, you can ignore it.'));
    }
}
