<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\RedirectsToCurrentOrganization;
use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Fortify;
use Laravel\Passkeys\Contracts\PasskeyLoginResponse as PasskeyLoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

class PasskeyLoginResponse implements PasskeyLoginResponseContract
{
    use RedirectsToCurrentOrganization;

    public function toResponse($request): Response
    {
        // A fresh sign-in counts as a recent confirmation (e.g. for managing passkeys).
        $request->session()->passwordConfirmed();

        $redirect = $this->redirectPathForCurrentOrganization($request, Fortify::redirects('login'));

        return $request->wantsJson()
            ? new JsonResponse(['redirect' => redirect()->intended($redirect)->getTargetUrl()], 200)
            : redirect()->intended($redirect);
    }
}
