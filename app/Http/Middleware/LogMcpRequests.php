<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Logs MCP calls (JSON-RPC method, tool, user, duration) for troubleshooting. Arguments are not
 * logged, since they may contain time entry descriptions.
 */
class LogMcpRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = microtime(true);
        $response = $next($request);

        $method = $request->json('method');
        $tool = $request->json('params.name');
        $user = $request->user();

        if (is_string($method) && $method !== 'notifications/initialized') {
            Log::info('mcp.request', [
                'method' => $method,
                'tool' => $method === 'tools/call' && is_string($tool) ? $tool : null,
                'user_id' => $user instanceof User ? $user->id : null,
                'status' => $response->getStatusCode(),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        }

        return $response;
    }
}
