export type BoostGateway = 'stripe' | 'store';

/** Card is €0.010 per person. Store is €0.0125 per person. */
export const BOOST_UNIT_PRICE_EUR: Record<BoostGateway, number> = {
    stripe: 0.01,
    store: 0.0125,
};

/** Stripe will not open a checkout below this. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

export function boostQuoteCents(audience: number, multiplier: number, gateway: BoostGateway): number {
    const cents = Math.round(audience * BOOST_UNIT_PRICE_EUR[gateway] * multiplier * 100);
    if (gateway === 'stripe' && cents > 0 && cents < STRIPE_MIN_CHARGE_CENTS) {
        return STRIPE_MIN_CHARGE_CENTS;
    }
    return cents;
}

export function formatBoostEur(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
}
