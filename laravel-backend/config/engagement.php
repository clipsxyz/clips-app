<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Inactive digest (Instagram-style "what you missed" email)
    |--------------------------------------------------------------------------
    */
    'inactive_days' => (int) env('ENGAGEMENT_INACTIVE_DAYS', 3),
    'digest_cooldown_hours' => (int) env('ENGAGEMENT_DIGEST_COOLDOWN_HOURS', 48),
    'max_posts_in_email' => (int) env('ENGAGEMENT_DIGEST_MAX_POSTS', 5),
    'last_active_touch_minutes' => (int) env('ENGAGEMENT_LAST_ACTIVE_TOUCH_MINUTES', 5),
];
