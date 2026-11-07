import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform } from 'react-native';
import {
    endConnection,
    finishTransaction,
    flushFailedPurchasesCachedAsPendingAndroid,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    type ProductPurchase,
    type PurchaseError,
} from 'react-native-iap';
import { apiRequest } from '../api/client';
import { BOOST_ACTIVATED_EVENT } from '../components/BoostActivatedModal.native';
import { BOOST_STATUS_REFRESH_EVENT } from '../navigation/linking';

const PENDING_KEY = '@gazetteer_store_boost_pending';

export type PendingStoreBoost = {
    sku: string;
    postId: string;
    radius: number;
    tier: 'standard' | 'premium' | 'featured';
    durationHours: 6 | 12 | 24 | 72;
};

type Waiter = {
    sku: string;
    resolve: () => void;
    reject: (error: Error) => void;
};

const waiters: Waiter[] = [];
const finishedKeys = new Set<string>();
let boot: Promise<void> | null = null;
let stopBilling: (() => void) | null = null;
let connected = false;

async function ensureStoreBilling(): Promise<void> {
    if (boot) {
        await boot;
        return;
    }
    boot = (async () => {
        await initConnection();
        connected = true;
        const updateSub = purchaseUpdatedListener((purchase) => {
            void onPurchase(purchase);
        });
        const errorSub = purchaseErrorListener((error) => {
            void AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
            rejectWaiters(purchaseError(error));
        });
        stopBilling = () => {
            updateSub.remove();
            errorSub.remove();
            stopBilling = null;
            boot = null;
            if (connected) {
                connected = false;
                void endConnection();
            }
        };
        if (Platform.OS === 'android') {
            await flushFailedPurchasesCachedAsPendingAndroid().catch(() => undefined);
        }
        const available = await getAvailablePurchases().catch(() => []);
        for (const purchase of available) {
            await onPurchase(purchase);
        }
    })().catch((error) => {
        boot = null;
        connected = false;
        throw error;
    });
    await boot;
}

/** Open the store connection and keep unfinished purchases from being dropped. */
export async function startStoreBilling(): Promise<() => void> {
    await ensureStoreBilling();
    return () => stopBilling?.();
}

function purchaseKey(purchase: ProductPurchase): string {
    return String(purchase.purchaseToken || purchase.transactionId || '');
}

async function readPending(): Promise<PendingStoreBoost | null> {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingStoreBoost;
        if (!parsed?.sku || !parsed.postId) return null;
        return parsed;
    } catch {
        return null;
    }
}

function rejectWaiters(error: Error): void {
    const pending = waiters.splice(0, waiters.length);
    pending.forEach((waiter) => waiter.reject(error));
}

function resolveWaiters(sku: string): void {
    const pending = waiters.splice(0, waiters.length);
    pending.forEach((waiter) => {
        if (waiter.sku === sku) waiter.resolve();
        else waiter.reject(new Error('A different store purchase finished'));
    });
}

async function verifyAndFinish(purchase: ProductPurchase, context: PendingStoreBoost): Promise<void> {
    const purchaseToken = String(purchase.purchaseToken || purchase.transactionId || '');
    if (!purchaseToken) {
        throw new Error('The store did not return a purchase token');
    }
    const data = await apiRequest('/boosts/verify-native-purchase', {
        method: 'POST',
        body: JSON.stringify({
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            product_id: purchase.productId,
            purchase_token: purchaseToken,
            transaction_id: purchase.transactionId,
            receipt: purchase.transactionReceipt,
            post_id: context.postId,
            radius: context.radius,
            tier: context.tier,
            duration: context.durationHours,
        }),
    }) as { error?: string; post_id?: string; feed_type?: string };
    if (data?.error) throw new Error(data.error);
    await finishTransaction({ purchase, isConsumable: true });
    await AsyncStorage.removeItem(PENDING_KEY);
    DeviceEventEmitter.emit('boostActivated', { postId: context.postId, feedType: data.feed_type });
    DeviceEventEmitter.emit(BOOST_STATUS_REFRESH_EVENT);
    DeviceEventEmitter.emit(BOOST_ACTIVATED_EVENT);
}

async function onPurchase(purchase: ProductPurchase): Promise<void> {
    const key = purchaseKey(purchase);
    if (!key || finishedKeys.has(key)) return;
    const pending = await readPending();
    if (!pending || pending.sku !== purchase.productId) return;
    finishedKeys.add(key);
    try {
        await verifyAndFinish(purchase, pending);
        resolveWaiters(pending.sku);
    } catch (error) {
        finishedKeys.delete(key);
        const message = error instanceof Error ? error.message : 'Could not confirm the store purchase';
        rejectWaiters(new Error(message));
    }
}

function purchaseError(error: PurchaseError): Error {
    const code = String(error.code || '');
    const cancelled = code === 'E_USER_CANCELLED'
        || code === 'E_USER_CANCELED'
        || code === 'E_INTERRUPTED'
        || /cancel|dismiss/i.test(error.message || '');
    const unavailable = [
        'E_IAP_NOT_AVAILABLE',
        'E_NOT_PREPARED',
        'E_SERVICE_ERROR',
        'E_NETWORK_ERROR',
        'E_BILLING_UNAVAILABLE',
        'E_DEVELOPER_ERROR',
        'E_ITEM_UNAVAILABLE',
    ].includes(code) || /unavailable|not available|billing/i.test(error.message || '');
    const wrapped = new Error(
        cancelled
            ? 'Payment cancelled'
            : unavailable
                ? 'Store billing is unavailable right now.'
                : (error.message || 'The store could not complete the payment'),
    );
    (wrapped as Error & { cancelled?: boolean; unavailable?: boolean }).cancelled = cancelled;
    (wrapped as Error & { unavailable?: boolean }).unavailable = unavailable;
    return wrapped;
}

/**
 * Android takes `{ skus }`. iOS takes `{ sku }`.
 * The purchase is finished only after the server accepts the receipt.
 */
export function purchaseBoostWithStore(context: PendingStoreBoost): Promise<void> {
    return new Promise((resolve, reject) => {
        const waiter: Waiter = { sku: context.sku, resolve, reject };
        waiters.push(waiter);
        void (async () => {
            try {
                await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(context));
                await ensureStoreBilling();
                if (!waiters.includes(waiter)) return;
                const result = await requestPurchase(
                    Platform.OS === 'ios'
                        ? { sku: context.sku, andDangerouslyFinishTransactionAutomaticallyIOS: false }
                        : { skus: [context.sku] },
                );
                const purchases = Array.isArray(result) ? result : result ? [result] : [];
                for (const purchase of purchases) {
                    await onPurchase(purchase);
                }
            } catch (error) {
                const index = waiters.indexOf(waiter);
                if (index >= 0) waiters.splice(index, 1);
                await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
                const wrapped = error instanceof Error && 'code' in error
                    ? purchaseError(error as PurchaseError)
                    : (error instanceof Error ? error : new Error('The store could not start the payment'));
                reject(wrapped);
            }
        })();
    });
}
