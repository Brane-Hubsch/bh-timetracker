<?php

namespace App\Http\Controllers\Clients;

use App\Actions\Clients\FindClientWebsiteLogo;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Support\WebsiteUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class ClientWebsiteLogoController extends Controller
{
    public function __invoke(Request $request, FindClientWebsiteLogo $findLogo): JsonResponse
    {
        Gate::authorize('create', Client::class);

        $validated = Validator::make(
            ['website' => WebsiteUrl::normalize($request->input('website'))],
            ['website' => ['required', ...WebsiteUrl::rules()]],
            attributes: ['website' => __('Website')],
        )->validate();

        return response()->json(['logo' => $findLogo->handle($validated['website'])]);
    }
}
