<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\BoostMetric;
use Illuminate\Http\JsonResponse;

class BoostAnalyticsController extends Controller
{
    public function show(Boost $boost): JsonResponse
    {
        abort_if($boost->user_id !== request()->user()->id, 403);

        $days = (int) request()->query('days', 7);
        if (! in_array($days, [7, 30], true)) {
            $days = 7;
        }

        $since = now()->subDays($days - 1)->toDateString();
        $daily = $this->dailyMetrics($boost, $since);
        $fromMetrics = $this->dailyTotal($daily) > 0;
        if (! $fromMetrics) {
            $fromEvents = $this->dailyFromEvents($boost, $since);
            if ($fromEvents !== []) {
                $daily = $fromEvents;
            }
        }

        $impressions = 0;
        $reach = 0;
        $clicks = 0;
        foreach ($daily as $day) {
            $impressions += (int) $day['impressions'];
            $reach += (int) $day['reach'];
            $clicks += (int) $day['clicks'];
        }

        $post = $boost->post;
        if ($impressions + $reach + $clicks === 0) {
            $impressions = (int) ($boost->impressions_count ?? 0);
        }

        // Insights shows the post's views when boost tracking has little or nothing.
        // A single owner-side event must not hide that total.
        $postViews = (int) ($post->views_count ?? 0);
        if (! $fromMetrics && $postViews > $impressions) {
            $impressions = $postViews;
            $engagement = (int) ($post->likes_count ?? 0)
                + (int) ($post->comments_count ?? 0)
                + (int) ($post->shares_count ?? 0);
            if ($engagement > $clicks) {
                $clicks = $engagement;
            }
            $daily = [];
        }

        if ($this->dailyTotal($daily) === 0) {
            $daily = [];
        }

        if ($daily === [] && ($impressions > 0 || $reach > 0 || $clicks > 0)) {
            $day = $boost->activated_at?->toDateString() ?? now()->toDateString();
            if ($day < $since) {
                $day = now()->toDateString();
            }
            $daily = [[
                'date' => $day,
                'impressions' => $impressions,
                'reach' => $reach,
                'clicks' => $clicks,
                'ctr' => $impressions > 0 ? round(($clicks / $impressions) * 100, 2) : 0.00,
            ]];
        }

        $ctr = $impressions > 0 ? round(($clicks / $impressions) * 100, 2) : 0.00;
        $status = $boost->expires_at && $boost->expires_at->isFuture() ? 'active' : 'expired';
        $postTitle = trim((string) ($post->caption ?: $post->text_content ?: $post->image_text ?: ''));

        return response()->json([
            'success' => true,
            'data' => [
                'boost_id' => $boost->id,
                'post_title' => $postTitle !== '' ? $postTitle : 'Boost performance',
                'status' => $status,
                'spend' => $boost->chargedSpendEur(),
                'summary' => [
                    'impressions' => $impressions,
                    'reach' => $reach,
                    'clicks' => $clicks,
                    'ctr' => $ctr,
                ],
                'daily' => array_values($daily),
            ],
        ]);
    }

    /**
     * @return array<int, array{date: string|null, impressions: int, reach: int, clicks: int, ctr: float}>
     */
    private function dailyMetrics(Boost $boost, string $since): array
    {
        return $boost->metrics()
            ->whereDate('date', '>=', $since)
            ->orderByDesc('date')
            ->get()
            ->map(function (BoostMetric $metric) {
                $dayImpressions = (int) $metric->impressions;
                $dayClicks = (int) $metric->clicks;

                return [
                    'date' => $metric->date?->toDateString(),
                    'impressions' => $dayImpressions,
                    'reach' => (int) $metric->reach,
                    'clicks' => $dayClicks,
                    'ctr' => $dayImpressions > 0 ? round(($dayClicks / $dayImpressions) * 100, 2) : 0.00,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{impressions: int, reach: int, clicks: int}>  $daily
     */
    private function dailyTotal(array $daily): int
    {
        $total = 0;
        foreach ($daily as $day) {
            $total += (int) $day['impressions'] + (int) $day['reach'] + (int) $day['clicks'];
        }

        return $total;
    }

    /**
     * @return array<int, array{date: string, impressions: int, reach: int, clicks: int, ctr: float}>
     */
    private function dailyFromEvents(Boost $boost, string $since): array
    {
        $events = BoostAnalyticsEvent::query()
            ->where('boost_id', $boost->id)
            ->where('created_at', '>=', $since.' 00:00:00')
            ->whereIn('event_type', ['impression', 'reach', 'click'])
            ->get(['event_type', 'created_at']);

        $byDay = [];
        foreach ($events as $event) {
            $day = $event->created_at?->toDateString();
            if (! $day) {
                continue;
            }
            $byDay[$day] ??= ['impressions' => 0, 'reach' => 0, 'clicks' => 0];
            if ($event->event_type === 'impression') {
                $byDay[$day]['impressions']++;
            } elseif ($event->event_type === 'reach') {
                $byDay[$day]['reach']++;
            } elseif ($event->event_type === 'click') {
                $byDay[$day]['clicks']++;
            }
        }

        krsort($byDay);
        $daily = [];
        foreach ($byDay as $day => $counts) {
            $impressions = (int) $counts['impressions'];
            $clicks = (int) $counts['clicks'];
            $daily[] = [
                'date' => $day,
                'impressions' => $impressions,
                'reach' => (int) $counts['reach'],
                'clicks' => $clicks,
                'ctr' => $impressions > 0 ? round(($clicks / $impressions) * 100, 2) : 0.00,
            ];
        }

        return $daily;
    }
}
