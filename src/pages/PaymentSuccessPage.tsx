import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activateBoost } from '../api/boost';
import { formatBoostWindow } from '../utils/boostProgress';
import type { BoostFeedType, BoostDuration } from '../components/BoostSelectionModal';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';

const STORAGE_KEY = 'boostPaymentPending';

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
        let data: { postId: string; feedType: BoostFeedType; price: number; userId: string; radiusKm?: number; eligibleUsersCount?: number; durationHours?: BoostDuration; centerLocal?: string; action?: 'create' | 'extend'; goal?: 'views' | 'profile_visits' | 'messages' };
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
            action: data.action,
            goal: data.goal,
        })
            .then(() => {
                const label = data.feedType === 'local' ? 'Local' : data.feedType === 'regional' ? 'Regional' : 'National';
                const windowLabel = formatBoostWindow(data.durationHours ?? 6);
                const message = data.action === 'extend'
                    ? `Added ${windowLabel} to this boost in the ${label} feed.`
                    : `Your post is boosted for ${windowLabel} in the ${label} feed.`;
                return Swal.fire(bottomSheet({
                    title: 'Payment Complete!',
                    message,
                    icon: 'success',
                    confirmButtonText: 'OK',
                }));
            })
            .then(() => {
                navigate('/boost', { state: { boostSuccess: true, postId: data.postId, feedType: data.feedType } });
            })
            .catch((err) => {
                console.error('Activate boost after redirect:', err);
                navigate('/boost');
            });
    }, [navigate, handled]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">Completing your payment...</p>
        </div>
    );
}
