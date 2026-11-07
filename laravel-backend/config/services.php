<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Firebase Configuration
    |--------------------------------------------------------------------------
    |
    | Firebase Cloud Messaging (FCM) credentials for push notifications
    |
    */

    'firebase' => [
        'project_id' => env('FIREBASE_PROJECT_ID'),
        // Absolute path so Kreait\Firebase\Factory::withServiceAccount() can open the
        // service-account JSON regardless of the process working directory.
        'credentials' => (static function (): string {
            $configured = env('FIREBASE_CREDENTIALS', 'storage/app/firebase-auth.json');
            $configured = is_string($configured) ? trim($configured) : '';
            if ($configured === '') {
                return storage_path('app/firebase-auth.json');
            }
            $isAbsolute = str_starts_with($configured, DIRECTORY_SEPARATOR)
                || (bool) preg_match('#^[A-Za-z]:\\\\#', $configured);
            if ($isAbsolute) {
                return $configured;
            }

            return base_path($configured);
        })(),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY', env('STRIPE_PUBLISHABLE_KEY')),
        'secret' => env('STRIPE_SECRET', env('STRIPE_SECRET_KEY')),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'webhook' => [
            'secret' => env('STRIPE_WEBHOOK_SECRET'),
        ],
    ],

    'google_maps' => [
        'api_key' => env('GOOGLE_MAPS_API_KEY', env('Maps_API_KEY')),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_AUTH_TOKEN'),
        'from' => env('TWILIO_FROM'),
        'whatsapp_from' => env('TWILIO_WHATSAPP_FROM'),
        'otp_channel' => env('OTP_CHANNEL', 'whatsapp'),
    ],

    'facebook' => [
        'app_id' => env('FACEBOOK_APP_ID'),
        'app_secret' => env('FACEBOOK_APP_SECRET'),
        'graph_version' => env('FACEBOOK_GRAPH_VERSION', 'v20.0'),
    ],

    'google_play' => [
        'package_name' => env('GOOGLE_PLAY_PACKAGE_NAME', 'com.clipsapp'),
        'service_account' => env('GOOGLE_PLAY_SERVICE_ACCOUNT'),
        'access_token' => env('GOOGLE_PLAY_ACCESS_TOKEN'),
    ],

    'app_store' => [
        'shared_secret' => env('APPLE_IAP_SHARED_SECRET'),
    ],

];