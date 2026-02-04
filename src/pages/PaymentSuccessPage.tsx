import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activateBoost } from '../api/boost';
import type { BoostFeedType } from '../components/BoostSelectionModal';
import Swal from 'sweetalert2';

const STORAGE_KEY = 'boostPaymentPending';

export default function PaymentSuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [handled, setHandled] = React.useState(false);

    React.useEffect(() => {
        if (handled) return;
        const raw = sessionStorage.getItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        if (!raw) {
            navigate('/boost');
            return;
        }
        let data: { postId: string; feedType: BoostFeedType; price: number; userId: string };
        try {
            data = JSON.parse(raw);
        } catch {
            navigate('/boost');
            return;
        }
        setHandled(true);
        activateBoost(data.postId, data.userId, data.feedType, data.price)
            .then(() => {
                const label = data.feedType === 'local' ? 'Local' : data.feedType === 'regional' ? 'Regional' : 'National';
                return Swal.fire({
                    icon: 'success',
                    title: 'Payment Complete!',
                    html: `Your post is boosted for <strong>6 hours</strong> in the <strong>${label}</strong> feed.`,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#8B5CF6',
                });
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
