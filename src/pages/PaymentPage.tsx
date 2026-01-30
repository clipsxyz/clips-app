import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiLock, FiCreditCard } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { useAuth } from '../context/Auth';
import { activateBoost } from '../api/boost';
import type { Post } from '../types';
import type { BoostFeedType } from '../components/BoostSelectionModal';

interface PaymentPageLocationState {
    post: Post;
    feedType: BoostFeedType;
    price: number;
}

export default function PaymentPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const state = location.state as PaymentPageLocationState | null;

    const [cardNumber, setCardNumber] = React.useState('');
    const [cardName, setCardName] = React.useState('');
    const [expiryDate, setExpiryDate] = React.useState('');
    const [cvv, setCvv] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Redirect if no state or if post is not owned by current user (only user-created posts can be boosted)
    React.useEffect(() => {
        if (!state) {
            navigate('/boost');
            return;
        }
        if (!user?.handle || state.post.userHandle !== user.handle || state.post.originalUserHandle) {
            navigate('/boost');
        }
    }, [state, user?.handle, navigate]);

    if (!state) {
        return null;
    }

    const { post, feedType, price } = state;

    // Only the post creator can boost (no reclips, no other users' posts)
    const canBoostThisPost = user?.handle && post.userHandle === user.handle && !post.originalUserHandle;

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return v;
        }
    };

    const formatExpiryDate = (value: string) => {
        const v = value.replace(/\D/g, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCardNumber(formatCardNumber(e.target.value));
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setExpiryDate(formatExpiryDate(e.target.value));
    };

    const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, '');
        setCvv(v.substring(0, 3));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canBoostThisPost) {
            navigate('/boost');
            return;
        }
        setIsProcessing(true);

        try {
            // Simulate payment processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Activate boost with epoch time tracking (only for user-created posts; canBoostThisPost already enforced)
            if (user?.id) {
                await activateBoost(post.id, user.id, feedType, price);
            }

            setIsProcessing(false);

            // Show SweetAlert popup
            const result = await Swal.fire({
                icon: 'success',
                title: 'Gazetteer says',
                html: `
                    <p style="font-weight: 600; font-size: 1.25em; margin: 0 0 1rem 0;">Payment Complete!</p>
                    <p style="margin: 1rem 0; color: #374151;">Your payment is complete and your post is boosted for <strong>6 hours</strong> in the <strong>${getFeedTypeLabel(feedType)}</strong>.</p>
                    <p style="margin-top: 1rem; color: #6B7280; font-size: 0.9rem;">Thank you for using our boost service!</p>
                `,
                showCancelButton: true,
                confirmButtonText: 'Back to Newsfeed',
                cancelButtonText: 'Stay on Boost Page',
                confirmButtonColor: '#8B5CF6',
                cancelButtonColor: '#6B7280',
                customClass: {
                    popup: 'rounded-2xl',
                    confirmButton: 'px-6 py-2 rounded-lg font-semibold',
                    cancelButton: 'px-6 py-2 rounded-lg font-semibold'
                },
                buttonsStyling: true,
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            // Redirect based on user choice (pass feedType so feed can show Sponsored label)
            if (result.isConfirmed) {
                navigate('/feed', { state: { boostSuccess: true, postId: post.id, feedType } });
            } else {
                navigate('/boost', { state: { boostSuccess: true, postId: post.id, feedType } });
            }
        } catch (error) {
            console.error('Payment error:', error);
            setIsProcessing(false);
            // Show error message (you can add error state here)
        }
    };

    const getFeedTypeLabel = (type: BoostFeedType) => {
        switch (type) {
            case 'local':
                return 'Local Newsfeed';
            case 'regional':
                return 'Regional Newsfeed';
            case 'national':
                return 'National Newsfeed';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 dark:from-gray-900 dark:to-gray-950">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/boost')}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Back"
                        >
                            <FiArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payment</h1>
                    </div>
                </div>

                {/* Order Summary */}
                <div className="px-4 pt-6 pb-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 mb-4">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                            Order Summary
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Boost Type</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {getFeedTypeLabel(feedType)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Duration</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">6 hours</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 flex items-center justify-between">
                                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total</span>
                                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                                    €{price.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <div className="px-4 pb-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Card Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Card Number
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                                    <FiCreditCard className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={cardNumber}
                                    onChange={handleCardNumberChange}
                                    placeholder="1234 5678 9012 3456"
                                    maxLength={19}
                                    required
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Cardholder Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Cardholder Name
                            </label>
                            <input
                                type="text"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value)}
                                placeholder="John Doe"
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                        </div>

                        {/* Expiry and CVV */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Expiry Date
                                </label>
                                <input
                                    type="text"
                                    value={expiryDate}
                                    onChange={handleExpiryChange}
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    CVV
                                </label>
                                <input
                                    type="text"
                                    value={cvv}
                                    onChange={handleCvvChange}
                                    placeholder="123"
                                    maxLength={3}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Security Notice */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <FiLock className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Your payment information is encrypted and secure. We use industry-standard SSL encryption to protect your data.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isProcessing}
                            className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${isProcessing
                                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                : 'bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-lg hover:shadow-xl active:scale-[0.98]'
                                }`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Processing...
                                </span>
                            ) : (
                                `Pay €${price.toFixed(2)}`
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

