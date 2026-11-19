<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\RedirectsToCurrentOrganization;
use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Laravel\Fortify\Fortify;
use Symfony\Component\HttpFoundation\Response;

class LoginResponse implements LoginResponseContract
{
    use RedirectsToCurrentOrganization;

    public function toResponse($request): Response
    {
        // A fresh sign-in counts as a recent confirmation (e.g. for managing passkeys).
        $request->session()->passwordConfirmed();

        return $request->wantsJson()
            ? new JsonResponse(['redirect' => redirect()->intended($this->redirectPathForCurrentOrganization($request, Fortify::redirects('login')))->getTargetUrl()], 200)
            : redirect()->intended($this->redirectPathForCurrentOrganization($request, Fortify::redirects('login')));
    }
}
