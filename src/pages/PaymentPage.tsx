import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiLock } from 'react-icons/fi';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/Auth';
import { createBoostPaymentIntent } from '../api/client';
import type { Post } from '../types';
import type { BoostFeedType, BoostGoal, BoostDuration } from '../components/BoostSelectionModal';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const isPlaceholderKey = !stripePublishableKey || stripePublishableKey.includes('your_publishable_key_here') || stripePublishableKey === 'pk_test_xxx';
const stripePromise = !isPlaceholderKey && stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentPageLocationState {
    post: Post;
    feedType: BoostFeedType;
    price: number;
    goal?: BoostGoal;
    durationHours?: BoostDuration;
    estimatedReach?: string;
    radiusKm?: number;
    eligibleUsersCount?: number;
}

function getFeedTypeLabel(type: BoostFeedType): string {
    switch (type) {
        case 'local': return 'Local Newsfeed';
        case 'regional': return 'Regional Newsfeed';
        case 'national': return 'National Newsfeed';
    }
}

function getGoalLabel(goal?: BoostGoal): string {
    switch (goal) {
        case 'profile_visits': return 'Profile visits';
        case 'messages': return 'Messages';
        case 'views':
        default:
            return 'More views';
    }
}

function StripePaymentForm({
    post,
    feedType,
    price,
    canBoostThisPost,
    userId,
    radiusKm,
    durationHours,
    eligibleUsersCount,
}: {
    post: Post;
    feedType: BoostFeedType;
    price: number;
    canBoostThisPost: boolean;
    userId: string | undefined;
    radiusKm?: number;
    durationHours?: BoostDuration;
    eligibleUsersCount?: number;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [paymentElementReady, setPaymentElementReady] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !canBoostThisPost || !paymentElementReady || !userId) return;
        setIsProcessing(true);
        setErrorMessage(null);
        try {
            sessionStorage.setItem('boostPaymentPending', JSON.stringify({
                postId: post.id,
                feedType,
                price,
                userId,
                radiusKm,
                eligibleUsersCount,
                durationHours,
            }));
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/payment-success`,
                },
            });
            if (error) {
                sessionStorage.removeItem('boostPaymentPending');
                setErrorMessage(error.message ?? 'Payment failed');
                setIsProcessing(false);
                return;
            }
            setErrorMessage(null);
        } catch (err: any) {
            setErrorMessage(err?.message ?? 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement options={{ layout: 'tabs' }} onReady={() => setPaymentElementReady(true)} />
            {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
            <button
                type="submit"
                disabled={!stripe || !paymentElementReady || isProcessing}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${!stripe || !paymentElementReady || isProcessing
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-lg hover:shadow-xl active:scale-[0.98]'
                }`}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Processing...
                    </span>
                ) : !paymentElementReady ? (
                    'Loading payment form...'
                ) : (
                    `Pay €${price.toFixed(2)}`
                )}
            </button>
        </form>
    );
}

export default function PaymentPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const state = location.state as PaymentPageLocationState | null;

    const [clientSecret, setClientSecret] = React.useState<string | null>(null);
    const [stripeError, setStripeError] = React.useState<string | null>(null);

    const isOwnPost = user?.handle && state?.post?.userHandle === user.handle && !state?.post?.originalUserHandle;
    const canBoostThisPost = Boolean(user?.handle && state?.post?.userHandle === user.handle && !state?.post?.originalUserHandle);

    React.useEffect(() => {
        if (!state) {
            navigate('/boost');
            return;
        }
        if (!isOwnPost) {
            navigate('/boost');
        }
    }, [state, user?.handle, navigate, isOwnPost]);

    const fetchPaymentIntent = React.useCallback(() => {
        if (!state || !stripePromise) return;
        if (!user?.id) return;

        setStripeError(null);
        createBoostPaymentIntent({
            postId: state.post.id,
            feedType: state.feedType,
            userId: user.id,
            radiusKm: state.radiusKm ?? 2,
            durationHours: state.durationHours ?? 6,
        })
            .then(({ clientSecret: secret }) => setClientSecret(secret))
            .catch((err) => setStripeError(err?.message ?? 'Could not start payment'));
    }, [state?.post?.id, state?.feedType, state?.radiusKm, state?.durationHours, user?.id, stripePromise]);

    React.useEffect(() => {
        if (!state || !stripePromise) return;
        fetchPaymentIntent();
    }, [state?.post?.id, state?.feedType, stripePromise, fetchPaymentIntent]);

    if (!state) {
        return null;
    }

    const { post, feedType, price, goal, durationHours, estimatedReach } = state;
    const durationLabel = durationHours ? `${durationHours} hours` : '6 hours';

    const useStripeForm = Boolean(stripePromise && clientSecret && !stripeError);
    const isLoadingStripe = Boolean(stripePromise && !clientSecret && !stripeError);

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 dark:from-gray-900 dark:to-gray-950">
            <div className="max-w-md mx-auto">
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/boost')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Back">
                            <FiArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payment</h1>
                    </div>
                </div>

                <div className="px-4 pt-6 pb-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 mb-4">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Order Summary</h2>
                        <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Goal</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{getGoalLabel(goal)}</span>
                                </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Boost Type</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{getFeedTypeLabel(feedType)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Duration</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{durationLabel}</span>
                            </div>
                                {estimatedReach && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Estimated Reach</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{estimatedReach}</span>
                                    </div>
                                )}
                            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 flex items-center justify-between">
                                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total</span>
                                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">€{price.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-6">
                    {isLoadingStripe ? (
                        <div className="py-8 text-center">
                            <p className="text-gray-600 dark:text-gray-400 mb-2">Loading Stripe payment form...</p>
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        </div>
                    ) : useStripeForm ? (
                        <Elements key={clientSecret} stripe={stripePromise!} options={{ clientSecret: clientSecret!, appearance: { theme: 'stripe' } }}>
                            <StripePaymentForm
                                post={post}
                                feedType={feedType}
                                price={price}
                                canBoostThisPost={!!canBoostThisPost}
                                userId={user?.id}
                                radiusKm={state.radiusKm}
                                durationHours={durationHours}
                                eligibleUsersCount={state.eligibleUsersCount}
                            />
                        </Elements>
                    ) : stripeError && stripePromise ? (
                        <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Stripe payment unavailable</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                                {stripeError === 'CONNECTION_REFUSED' || stripeError?.toLowerCase().includes('fetch') || stripeError?.toLowerCase().includes('connection')
                                    ? 'The app cannot reach the backend. Start the Laravel server: in a terminal run “php artisan serve” inside the laravel-backend folder (port 8000). Then click Try again.'
                                    : stripeError}
                            </p>
                            <button
                                type="button"
                                onClick={() => fetchPaymentIntent()}
                                className="text-sm font-semibold text-amber-800 dark:text-amber-200 underline hover:no-underline"
                            >
                                Try again
                            </button>
                            {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 font-medium">Using this device on the network? On your PC run: php artisan serve --host=0.0.0.0 (in laravel-backend) so the API is reachable at your IP.</p>
                            )}
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">If the backend is running, check laravel-backend/.env has STRIPE_SECRET=sk_test_... and run: composer require stripe/stripe-php</p>
                        </div>
                    ) : isPlaceholderKey ? (
                        <div className="mb-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm">
                            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Stripe not configured</p>
                            <p className="mb-2">Your .env has a placeholder key. Replace it with your real Stripe publishable key:</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs">
                                <li>Go to <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Stripe Dashboard → API keys</a></li>
                                <li>Copy the <strong>Publishable key</strong> (starts with pk_test_)</li>
                                <li>In your project root .env, set: VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx</li>
                                <li>Restart the dev server (npm run dev)</li>
                            </ol>
                        </div>
                    ) : null}

                    {useStripeForm && (
                        <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl mt-4">
                            <FiLock className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">Payments are powered by Stripe. Card data is sent directly to Stripe and never stored on our servers.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
