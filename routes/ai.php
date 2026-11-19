<?php

use App\Http\Middleware\LogMcpRequests;
use App\Mcp\Servers\TimetrackerServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

/*
| MCP server for AI assistants (Claude etc.). Clients authenticate with OAuth 2.1 (Passport); the
| discovery and dynamic client registration routes are public, so they are rate limited.
*/

Route::middleware('throttle:mcp-oauth')->group(function () {
    Mcp::oauthRoutes();
});

Mcp::web('/mcp', TimetrackerServer::class)
    ->middleware(['auth:api', 'throttle:mcp', LogMcpRequests::class])
    ->name('mcp');
