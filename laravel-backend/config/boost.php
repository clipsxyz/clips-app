<?php

$prices = [
    'local'    => 4.99,
    'regional' => 6.99,
    'national' => 9.99,
];

return [

    /*
    |--------------------------------------------------------------------------
    | Boost prices (EUR) – single source of truth for Stripe PaymentIntent
    |--------------------------------------------------------------------------
    | Used when creating PaymentIntents in sandbox or live. amounts_cents
    | is derived from these (Stripe expects smallest currency unit).
    */

    'currency' => 'eur',

    'prices' => $prices,

    'amounts_cents' => array_map(fn ($eur) => (int) round($eur * 100), $prices),

];
