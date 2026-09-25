import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activateBoost, getActiveBoost } from '../api/boost';
import type { BoostFeedType, BoostDuration } from '../components/BoostSelectionModal';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';

const STORAGE_KEY = 'boostPaymentPending';

/**
 * The Stripe webhook is the authoritative activation path — this only covers the
 * window before Stripe has delivered `payment_intent.succeeded`.
 */
async function waitForWebhookActivation(postId: string, attempts = 5): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            if (await getActiveBoost(postId)) return true;
        } catch {
            // keep polling
        }
    }
    return false;
}

export default function PaymentSuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [handled, setHandled] = React.useState(false);

    React.useEffect(() => {
        if (handled) return;
        const raw = sessionStorage.getItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        const paymentIntentId = searchParams.get('payment_intent');
        const redirectStatus = searchParams.get('redirect_status');

        if (!raw) {
            navigate('/boost');
            return;
        }
        let data: { postId: string; feedType: BoostFeedType; price: number; userId: string; radiusKm?: number; eligibleUsersCount?: number; durationHours?: BoostDuration; centerLocal?: string };
        try {
            data = JSON.parse(raw);
        } catch {
            navigate('/boost');
            return;
        }

        if (redirectStatus !== 'succeeded' || !paymentIntentId) {
            Swal.fire(bottomSheet({
                title: 'Payment incomplete',
                message: redirectStatus === 'requires_payment_method'
                    ? 'Payment could not be processed. Please try again with a different payment method.'
                    : 'Payment was not completed. Please try again.',
                icon: 'alert',
                confirmButtonText: 'Back to Boost',
            })).then(() => navigate('/boost'));
            return;
        }

        setHandled(true);
        activateBoost(data.postId, data.userId, data.feedType, data.price, paymentIntentId, {
            radiusKm: data.radiusKm,
            eligibleUsersCount: data.eligibleUsersCount,
            durationHours: data.durationHours,
            centerLocal: data.centerLocal,
        })
            .then(() => {
                const label = data.feedType === 'local' ? 'Local' : data.feedType === 'regional' ? 'Regional' : 'National';
                const hours = data.durationHours ?? 6;
                return Swal.fire(bottomSheet({
                    title: 'Payment Complete!',
                    message: `Your post is boosted for ${hours} hours in the ${label} feed.`,
                    icon: 'success',
                    confirmButtonText: 'OK',
                }));
            })
            .then(() => {
                navigate('/boost', { state: { boostSuccess: true, postId: data.postId, feedType: data.feedType } });
            })
            .catch(async (err) => {
                console.error('Activate boost after redirect:', err);

                // The payment is captured regardless of this request failing, so give the
                // webhook a moment to land before telling the user anything went wrong.
                const activatedByWebhook = await waitForWebhookActivation(data.postId);
                if (activatedByWebhook) {
                    navigate('/boost', { state: { boostSuccess: true, postId: data.postId, feedType: data.feedType } });
                    return;
                }

                await Swal.fire(bottomSheet({
                    title: 'Payment received',
                    message: 'Your payment went through and your boost is being activated. It may take a moment to appear in the feed.',
                    icon: 'info',
                    confirmButtonText: 'Back to Boost',
                }));
                navigate('/boost');
            });
    }, [navigate, handled]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">Completing your payment...</p>
        </div>
    );
}
