<?php

return [

    'currency' => 'eur',

    /*
    |--------------------------------------------------------------------------
    | Audience-based boost pricing
    |--------------------------------------------------------------------------
    | Boosts are priced per eligible user reached, multiplied by the selected
    | duration. This is the single source of truth for both /boost/estimate
    | and the Stripe PaymentIntent amount. Clients never send an amount;
    | the server derives it here and again from the paid Stripe amount on
    | activation.
    */

    'unit_price_cents' => 5,

    'duration_multipliers' => [
        6 => 1.0,
        12 => 1.75,
        24 => 2.8,
        72 => 6.2,
    ],

    /*
    |--------------------------------------------------------------------------
    | Default boost duration
    |--------------------------------------------------------------------------
    | Fallback used when a PaymentIntent carries no duration_hours metadata.
    | Every PaymentIntent created by createPaymentIntent sets it explicitly, so
    | this only guards legacy or hand-built intents.
    */

    'default_duration_hours' => 6,

];
