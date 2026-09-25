<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Allowed origins
    |--------------------------------------------------------------------------
    | Set CORS_ALLOWED_ORIGINS in .env to a comma-separated list of your
    | deployed web origins, e.g.
    |   CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
    |
    | Required for production: the default list below is local development
    | only and will not match a real domain. The LAN patterns below cover
    | phone testing on a local network.
    */

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env(
            'CORS_ALLOWED_ORIGINS',
            'http://localhost:5173,https://localhost:5173,http://localhost:3000,https://localhost:3000,http://127.0.0.1:5173,https://127.0.0.1:5173,http://127.0.0.1:3000,https://127.0.0.1:3000'
        ))
    ))),

    'allowed_origins_patterns' => [
        '/^https?:\/\/192\.168\.\d+\.\d+:5173$/',
        '/^https?:\/\/10\.\d+\.\d+\.\d+:5173$/',
        '/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:5173$/',
        '/^https?:\/\/localhost:5173$/',
        '/^https?:\/\/127\.0\.0\.1:5173$/',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
