<?php

namespace App\Services;

use Stripe\Checkout\Session;
use Stripe\Stripe;

class StripeCheckoutSessionLookup
{
    public function find(string $sessionId): Session
    {
        $secret = config('services.stripe.secret');
        if (! is_string($secret) || $secret === '') {
            throw new \RuntimeException('Stripe is not configured');
        }

        Stripe::setApiKey($secret);

        return Session::retrieve($sessionId);
    }
}
