<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class QueryProfiler
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$this->shouldProfile()) {
            return $next($request);
        }

        $queryCount = 0;
        $totalQueryTimeMs = 0.0;
        $slowestQueryMs = 0.0;
        $slowestQuerySql = null;

        DB::listen(function ($query) use (&$queryCount, &$totalQueryTimeMs, &$slowestQueryMs, &$slowestQuerySql) {
            $queryCount++;
            $duration = (float) ($query->time ?? 0);
            $totalQueryTimeMs += $duration;

            if ($duration > $slowestQueryMs) {
                $slowestQueryMs = $duration;
                $slowestQuerySql = $query->sql;
            }
        });

        $startedAt = microtime(true);
        $response = $next($request);
        $requestDurationMs = (microtime(true) - $startedAt) * 1000;

        $response->headers->set('X-Query-Count', (string) $queryCount);
        $response->headers->set('X-Query-Time-Ms', number_format($totalQueryTimeMs, 2, '.', ''));
        $response->headers->set('X-Request-Time-Ms', number_format($requestDurationMs, 2, '.', ''));
        $response->headers->set('X-Slowest-Query-Ms', number_format($slowestQueryMs, 2, '.', ''));

        if ($slowestQuerySql !== null) {
            $normalizedSql = preg_replace('/\s+/', ' ', trim($slowestQuerySql));
            $response->headers->set('X-Slowest-Query', substr((string) $normalizedSql, 0, 240));
        }

        $this->logIfOverThreshold(
            $request,
            $queryCount,
            $totalQueryTimeMs,
            $requestDurationMs,
            $slowestQueryMs,
            $slowestQuerySql
        );

        return $response;
    }

    private function shouldProfile(): bool
    {
        if ((bool) env('QUERY_PROFILER_ENABLED', false)) {
            return true;
        }

        return app()->environment(['local', 'testing']);
    }

    private function logIfOverThreshold(
        Request $request,
        int $queryCount,
        float $totalQueryTimeMs,
        float $requestDurationMs,
        float $slowestQueryMs,
        ?string $slowestQuerySql
    ): void {
        $maxQueryCount = (int) env('QUERY_PROFILER_LOG_QUERY_COUNT_THRESHOLD', 25);
        $maxSlowestQueryMs = (float) env('QUERY_PROFILER_LOG_SLOWEST_MS_THRESHOLD', 50);
        $maxTotalQueryMs = (float) env('QUERY_PROFILER_LOG_TOTAL_MS_THRESHOLD', 120);
        $maxRequestMs = (float) env('QUERY_PROFILER_LOG_REQUEST_MS_THRESHOLD', 500);

        $shouldLog = $queryCount > $maxQueryCount
            || $slowestQueryMs > $maxSlowestQueryMs
            || $totalQueryTimeMs > $maxTotalQueryMs
            || $requestDurationMs > $maxRequestMs;

        if (!$shouldLog) {
            return;
        }

        $normalizedSql = $slowestQuerySql
            ? substr((string) preg_replace('/\s+/', ' ', trim($slowestQuerySql)), 0, 500)
            : null;

        logger()->warning('Query profiler threshold exceeded', [
            'method' => $request->method(),
            'path' => $request->path(),
            'query_count' => $queryCount,
            'query_time_ms' => round($totalQueryTimeMs, 2),
            'request_time_ms' => round($requestDurationMs, 2),
            'slowest_query_ms' => round($slowestQueryMs, 2),
            'slowest_query_sql' => $normalizedSql,
            'thresholds' => [
                'query_count' => $maxQueryCount,
                'slowest_ms' => $maxSlowestQueryMs,
                'total_query_ms' => $maxTotalQueryMs,
                'request_ms' => $maxRequestMs,
            ],
        ]);
    }
}

