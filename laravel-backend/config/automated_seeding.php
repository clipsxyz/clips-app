<?php

$feeds = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('NEWS_RSS_FEEDS', ''))
)));

return [
    /**
     * Scheduler gate. Artisan can still run either command by hand when this is false.
     */
    'enabled' => filter_var(env('ENABLE_AUTOMATED_SEEDING', false), FILTER_VALIDATE_BOOLEAN),

    'news_feeds' => $feeds,

    'system_handle' => 'GazetteerLocal',

    'llm' => [
        'url' => env('NEWS_LLM_API_URL', 'https://api.openai.com/v1/chat/completions'),
        'key' => env('NEWS_LLM_API_KEY'),
        'model' => env('NEWS_LLM_MODEL', 'gpt-4o-mini'),
    ],

    /** Google asks apps to reuse Places details for about 30 days. */
    'places_cache_days' => 30,
];
