import { NativeModules, Platform } from 'react-native';

export type StoreBoostQuote = {
    amount_cents?: number;
    currency?: string;
    product_id?: string;
    metadata?: Record<string, string>;
};

type StoreBillingModule = {
    purchase?: (payload: {
        amountCents: number;
        currency: string;
        productId: string;
        metadata?: Record<string, string>;
    }) => Promise<{ purchaseToken?: string }>;
};

/**
 * Opens Google Play Billing or StoreKit for a boost quote.
 * The installed build has to include GazetteerStoreBilling before the sheet can open.
 */
export async function startStoreBoostPurchase(quote: StoreBoostQuote): Promise<void> {
    const billing = NativeModules.GazetteerStoreBilling as StoreBillingModule | undefined;
    const storeName = Platform.OS === 'ios' ? 'the App Store' : 'Google Play';
    if (!billing?.purchase) {
        throw new Error(`Store billing is not in this app build yet. Pay by card, or reinstall the app to open ${storeName}.`);
    }
    const amountCents = Number(quote.amount_cents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error('Store quote was empty');
    }
    await billing.purchase({
        amountCents,
        currency: quote.currency || 'eur',
        productId: quote.product_id || 'gazetteer_boost',
        metadata: quote.metadata,
    });
}
