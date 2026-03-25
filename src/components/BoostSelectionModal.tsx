import React from 'react';
import { FiX, FiZap, FiMapPin, FiGlobe, FiTrendingUp } from 'react-icons/fi';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { estimateBoostPriceApi } from '../api/client';

export type BoostFeedType = 'local' | 'regional' | 'national';
export type BoostGoal = 'views' | 'profile_visits' | 'messages';
export type BoostDuration = 6 | 12 | 24 | 72;

export interface BoostOption {
    type: BoostFeedType;
    label: string;
    description: string;
    price: number;
    currency: string;
    icon: React.ReactNode;
    audience: string;
}

interface BoostSelectionModalProps {
    isOpen: boolean;
    post: Post | null;
    onClose: () => void;
    onSelect: (
        feedType: BoostFeedType,
        price: number,
        meta?: {
            goal: BoostGoal;
            durationHours: BoostDuration;
            estimatedReach: string;
            radiusKm: number;
            eligibleUsersCount: number;
        }
    ) => void;
}

const boostOptions: BoostOption[] = [
    {
        type: 'local',
        label: 'Local Newsfeed',
        description: 'Reach users in your local area',
        price: 4.99,
        currency: 'EUR',
        icon: <FiMapPin className="w-6 h-6" />,
        audience: 'Local audience'
    },
    {
        type: 'regional',
        label: 'Regional Newsfeed',
        description: 'Reach a larger regional audience',
        price: 6.99,
        currency: 'EUR',
        icon: <FiTrendingUp className="w-6 h-6" />,
        audience: 'Regional audience'
    },
    {
        type: 'national',
        label: 'National Newsfeed',
        description: 'Maximum reach across the country',
        price: 9.99,
        currency: 'EUR',
        icon: <FiGlobe className="w-6 h-6" />,
        audience: 'National audience'
    }
];

const goalOptions: Array<{ id: BoostGoal; label: string; description: string }> = [
    { id: 'views', label: 'More views', description: 'Increase post exposure in-feed' },
    { id: 'profile_visits', label: 'Profile visits', description: 'Drive people to your profile' },
    { id: 'messages', label: 'Messages', description: 'Get more direct replies and chats' },
];

const durationOptions: Array<{ hours: BoostDuration; label: string; multiplier: number }> = [
    { hours: 6, label: '6h', multiplier: 1 },
    { hours: 12, label: '12h', multiplier: 1.75 },
    { hours: 24, label: '24h', multiplier: 2.8 },
    { hours: 72, label: '3d', multiplier: 6.2 },
];

export default function BoostSelectionModal({
    isOpen,
    post,
    onClose,
    onSelect
}: BoostSelectionModalProps) {
    const [selectedOption, setSelectedOption] = React.useState<BoostFeedType | null>(null);
    const [selectedGoal, setSelectedGoal] = React.useState<BoostGoal>('views');
    const [selectedDuration, setSelectedDuration] = React.useState<BoostDuration>(6);
    const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1);

    const { user } = useAuth();

    if (!isOpen || !post) return null;
    const [radiusKm, setRadiusKm] = React.useState<number>(2);
    const [eligibleUsersCount, setEligibleUsersCount] = React.useState<number | null>(null);
    const [estimatedTotalPrice, setEstimatedTotalPrice] = React.useState<number | null>(null);
    const [estimateLoading, setEstimateLoading] = React.useState(false);
    const [estimateError, setEstimateError] = React.useState<string | null>(null);

    const selectedBoostOption = selectedOption ? boostOptions.find((o) => o.type === selectedOption) : null;
    const selectedDurationMeta = durationOptions.find((d) => d.hours === selectedDuration) ?? durationOptions[0];

    const estimatedReach = eligibleUsersCount != null ? `${eligibleUsersCount.toLocaleString()} users` : '--';
    const radiusOptions = [0.5, 1, 2, 3, 5, 10] as const;
    const canContinue =
        !!selectedOption &&
        estimatedTotalPrice != null &&
        estimatedTotalPrice > 0 &&
        !estimateLoading;
    const currentStep = activeStep;

    const handleSelect = (option: BoostOption) => {
        setSelectedOption(option.type);
    };

    const handleSubmit = () => {
        if (!selectedOption || eligibleUsersCount == null || estimatedTotalPrice == null) return;
        if (estimatedTotalPrice <= 0) return;

        onSelect(selectedOption, estimatedTotalPrice, {
            goal: selectedGoal,
            durationHours: selectedDuration,
            estimatedReach,
            radiusKm,
            eligibleUsersCount,
        });
    };

    React.useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!selectedOption || !user?.id || !radiusKm || radiusKm <= 0) {
                setEligibleUsersCount(null);
                setEstimatedTotalPrice(null);
                setEstimateError(null);
                return;
            }

            setEstimateLoading(true);
            setEstimateError(null);

            const useLaravel = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
            try {
                if (useLaravel) {
                    const res = await estimateBoostPriceApi({
                        feedType: selectedOption,
                        userId: user.id,
                        radiusKm,
                        durationHours: selectedDuration,
                    });

                    if (cancelled) return;
                    const ec = typeof res.eligibleUsersCount === 'number' ? res.eligibleUsersCount : null;
                    const priceEur = typeof res.priceEur === 'number' ? res.priceEur : null;

                    setEligibleUsersCount(ec);
                    setEstimatedTotalPrice(priceEur);
                    setEstimateLoading(false);
                } else {
                    // Mock: approximate based on feed tier + radius.
                    const baseByFeed: Record<BoostFeedType, number> = {
                        local: 1200,
                        regional: 2600,
                        national: 5400,
                    };
                    const multiplier = durationOptions.find((d) => d.hours === selectedDuration)?.multiplier ?? 1;
                    const eligible = Math.max(0, Math.round(baseByFeed[selectedOption] * (radiusKm / 2)));
                    const price = Number((eligible * 0.05 * multiplier).toFixed(2));
                    if (cancelled) return;
                    setEligibleUsersCount(eligible);
                    setEstimatedTotalPrice(price);
                    setEstimateLoading(false);
                }
            } catch (e: any) {
                if (cancelled) return;
                setEstimateLoading(false);
                setEstimateError(e?.message ?? 'Could not estimate boost');
                setEligibleUsersCount(null);
                setEstimatedTotalPrice(null);
            }
        }

        void run();
        return () => {
            cancelled = true;
        };
    }, [selectedOption, user?.id, radiusKm, selectedDuration]);

    React.useEffect(() => {
        if (!selectedOption && activeStep === 3) {
            setActiveStep(2);
        }
    }, [activeStep, selectedOption]);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 pt-6 pb-4 rounded-t-2xl z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                <FiZap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Boost Post</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Follow the steps to launch your promotion with clear goals, audience, and timing.
                    </p>

                    {/* Promote flow steps */}
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            {([
                                { id: 1, label: 'Goal' },
                                { id: 2, label: 'Audience' },
                                { id: 3, label: 'Duration' },
                            ] as const).map((step, idx) => {
                                const isDone = currentStep >= step.id;
                                return (
                                    <React.Fragment key={step.id}>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                                                    isDone
                                                        ? 'bg-brand-500 text-white'
                                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300'
                                                }`}
                                            >
                                                {step.id}
                                            </span>
                                            <span className={`text-xs font-semibold ${isDone ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < 2 && <div className={`h-[2px] flex-1 rounded ${currentStep > step.id ? 'bg-brand-400' : 'bg-gray-200 dark:bg-gray-800'}`} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Boost Options */}
                <div className="px-6 py-4 space-y-3">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveStep((prev) => (prev === 1 ? 2 : 1))}
                            className="w-full px-3 py-2.5 flex items-center justify-between"
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Step 1 - Goal</p>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                {goalOptions.find((g) => g.id === selectedGoal)?.label}
                            </span>
                        </button>
                        {activeStep === 1 && (
                            <div className="px-3 pb-3 grid grid-cols-1 gap-2">
                                {goalOptions.map((goal) => {
                                    const active = selectedGoal === goal.id;
                                    return (
                                        <button
                                            key={goal.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedGoal(goal.id);
                                                setActiveStep(2);
                                            }}
                                            className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                                                active
                                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                                    : 'border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{goal.label}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{goal.description}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-0.5">
                        Step 2 of 3: choose where you want this promotion shown.
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => {
                                if (!selectedOption) return;
                                setActiveStep((prev) => (prev === 2 ? 3 : 2));
                            }}
                            className="w-full px-3 py-2.5 flex items-center justify-between"
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Step 2 - Audience</p>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                {selectedBoostOption?.label || 'Choose'}
                            </span>
                        </button>
                        {activeStep === 2 && (
                            <div className="px-3 pb-3 space-y-2">
                                {boostOptions.map((option) => {
                                    const isSelected = selectedOption === option.type;
                                    return (
                                        <button
                                            key={option.type}
                                            onClick={() => {
                                                handleSelect(option);
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${isSelected
                                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-[1.02]'
                                                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                            ? 'bg-brand-500 text-white'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {option.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {option.label}
                                                        </h3>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                                                €0.05/user
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                        {option.description}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                            {option.audience}
                                                        </span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            priced by radius
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                                                        <svg
                                                            className="w-4 h-4 text-white"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {activeStep === 2 && selectedOption && (
                            <div className="px-3 pb-3 pt-0">
                                <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/10 dark:bg-gray-900/40 p-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                            Radius
                                        </p>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{radiusKm} km</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {radiusOptions.map((km) => {
                                            const active = radiusKm === km;
                                            return (
                                                <button
                                                    key={km}
                                                    type="button"
                                                    onClick={() => setRadiusKm(km)}
                                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                                        active
                                                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                                                            : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'
                                                    }`}
                                                >
                                                    {km}km
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {estimateLoading && (
                                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                            Calculating audience…
                                        </p>
                                    )}
                                    {estimateError && (
                                        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                                            {estimateError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => {
                                if (!selectedOption) return;
                                setActiveStep(3);
                            }}
                            disabled={!selectedOption}
                            className={`w-full px-3 py-2.5 flex items-center justify-between ${
                                !selectedOption ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Step 3 - Duration</p>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{selectedDurationMeta.label}</span>
                        </button>
                        {activeStep === 3 && (
                            <div className="px-3 pb-3 grid grid-cols-4 gap-2">
                                {durationOptions.map((duration) => {
                                    const active = selectedDuration === duration.hours;
                                    return (
                                        <button
                                            key={duration.hours}
                                            type="button"
                                            onClick={() => setSelectedDuration(duration.hours)}
                                            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                                                active
                                                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                                                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            {duration.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-6 py-4 rounded-b-2xl">
                    <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/70 dark:bg-gray-900/60">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Estimated reach</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{estimatedReach}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Duration</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedDurationMeta.hours}h</span>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!canContinue}
                        style={canContinue ? { background: 'linear-gradient(135deg, #3b82f6, #a855f7)' } : undefined}
                        className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${canContinue
                                ? 'hover:opacity-95 shadow-lg hover:shadow-xl active:scale-[0.98]'
                                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                            }`}
                    >
                        Continue to Payment
                    </button>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                        {selectedOption ? (
                            estimateLoading ? (
                                'Calculating audience…'
                            ) : estimatedTotalPrice != null && estimatedTotalPrice > 0 ? (
                                `Total today: €${estimatedTotalPrice.toFixed(2)} • Payment is secure and encrypted`
                            ) : (
                                'No eligible audience found for this radius'
                            )
                        ) : (
                            'Select an audience to continue to payment'
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

