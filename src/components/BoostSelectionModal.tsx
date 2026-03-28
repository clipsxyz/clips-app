import React from 'react';
import { FiX, FiZap, FiMapPin, FiGlobe, FiTrendingUp } from 'react-icons/fi';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { estimateBoostPriceApi } from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';

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
    const [selectedDuration, setSelectedDuration] = React.useState<BoostDuration>(6);
    const [activeStep, setActiveStep] = React.useState<1 | 2>(1);
    const [radiusKm, setRadiusKm] = React.useState<number>(2);
    const [eligibleUsersCount, setEligibleUsersCount] = React.useState<number | null>(null);
    const [estimatedTotalPrice, setEstimatedTotalPrice] = React.useState<number | null>(null);
    const [estimateLoading, setEstimateLoading] = React.useState(false);
    const [estimateError, setEstimateError] = React.useState<string | null>(null);

    const { user } = useAuth();

    const selectedBoostOption = selectedOption ? boostOptions.find((o) => o.type === selectedOption) : null;
    const selectedDurationMeta = durationOptions.find((d) => d.hours === selectedDuration) ?? durationOptions[0];

    const estimatedReach = eligibleUsersCount != null ? `${eligibleUsersCount.toLocaleString()} users` : '--';
    const radiusOptions = [0.5, 1, 2, 3, 5, 10] as const;
    const radiusIndex = Math.max(0, radiusOptions.indexOf(radiusKm as (typeof radiusOptions)[number]));
    const durationIndex = Math.max(0, durationOptions.findIndex((d) => d.hours === selectedDuration));
    const radiusFillPercent = (radiusIndex / Math.max(1, radiusOptions.length - 1)) * 100;
    const durationFillPercent = (durationIndex / Math.max(1, durationOptions.length - 1)) * 100;
    const firstVisualItem =
        post?.mediaItems?.find((item) => (item.type === 'image' || item.type === 'video') && !!item.url) ||
        post?.mediaItems?.[0];
    const previewUrl = firstVisualItem?.url || post?.mediaUrl || '';
    const previewType = (firstVisualItem?.type || post?.mediaType || 'text') as 'image' | 'video' | 'text';
    const previewTitle = post?.userHandle ? `@${post.userHandle}` : 'Gazetteer post';
    const previewSubtitle = 'Gazetteer selected post';
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
            goal: 'views',
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

            const useLaravel = isLaravelApiEnabled();
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
        if (!selectedOption && activeStep === 2) {
            setActiveStep(1);
        }
    }, [activeStep, selectedOption]);

    if (!isOpen || !post) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white dark:bg-[#0b0b0f] rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto border border-black/10 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                  .boost-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 24px;
                    background: transparent;
                  }
                  .boost-slider::-webkit-slider-runnable-track {
                    height: 4px;
                    border-radius: 9999px;
                    background: linear-gradient(to right, #0ea5e9 0%, #0ea5e9 var(--fill), rgba(148,163,184,0.35) var(--fill), rgba(148,163,184,0.35) 100%);
                  }
                  .boost-slider::-moz-range-track {
                    height: 4px;
                    border-radius: 9999px;
                    background: rgba(148,163,184,0.35);
                  }
                  .boost-slider::-moz-range-progress {
                    height: 4px;
                    border-radius: 9999px;
                    background: #0ea5e9;
                  }
                  .boost-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 9999px;
                    background: #ffffff;
                    border: 2px solid #e5e7eb;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    margin-top: -9px;
                  }
                  .boost-slider::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 9999px;
                    background: #ffffff;
                    border: 2px solid #e5e7eb;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                  }
                `}</style>
                {/* Header */}
                <div className="sticky top-0 bg-white/95 dark:bg-[#0b0b0f]/95 backdrop-blur border-b border-gray-200 dark:border-white/10 px-5 pt-4 pb-3 rounded-t-3xl z-10">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                                <FiZap className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Boost post</h2>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Step {currentStep} of 2</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Thin progress indicator */}
                    <div className="mt-2">
                        <div className="h-[3px] w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                style={{ width: `${(currentStep / 2) * 100}%` }}
                            />
                        </div>
                        <div className="mt-2 grid grid-cols-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <span className={currentStep >= 1 ? 'text-gray-900 dark:text-white' : ''}>Audience</span>
                            <span className={currentStep >= 2 ? 'text-gray-900 dark:text-white text-right' : 'text-right'}>Budget & time</span>
                        </div>
                    </div>

                    {/* Always-visible selected post preview (both steps) */}
                    <div className="mt-3 rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/10 p-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shrink-0 border border-white/40 dark:border-white/10">
                                {previewUrl ? (
                                    previewType === 'video' ? (
                                        <video src={previewUrl} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                        <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold text-sm">
                                        G
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                                    Selected post
                                </p>
                                <p className="text-xs text-gray-900 dark:text-gray-100 truncate">{previewTitle}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{previewSubtitle}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    {activeStep === 1 && (
                        <div className="space-y-3">
                            <h3 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Select audience</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Pick where to deliver your promotion.</p>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-3 mt-1">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Radius</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{radiusKm} km</p>
                                </div>
                                <div className="px-1">
                                    <input
                                        type="range"
                                        min={0}
                                        max={radiusOptions.length - 1}
                                        step={1}
                                        value={radiusIndex}
                                        onChange={(e) => {
                                            const idx = Number(e.target.value);
                                            const next = radiusOptions[idx];
                                            if (next != null) setRadiusKm(next);
                                        }}
                                        className="boost-slider"
                                        style={{ ['--fill' as any]: `${radiusFillPercent}%` }}
                                        aria-label="Radius in kilometers"
                                    />
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                        <span>{radiusOptions[0]} km</span>
                                        <span>{radiusOptions[radiusOptions.length - 1]} km</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {boostOptions.map((option) => {
                                    const isSelected = selectedOption === option.type;
                                    return (
                                        <button
                                            key={option.type}
                                            onClick={() => {
                                                handleSelect(option);
                                            }}
                                            className={`w-full p-4 rounded-2xl border transition-all duration-200 text-left ${
                                                isSelected
                                                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10'
                                                    : 'border-gray-200 dark:border-white/10 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        isSelected
                                                            ? 'bg-sky-500 text-white'
                                                            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {option.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{option.label}</h3>
                                                        <span className="text-xs font-semibold text-sky-600 dark:text-sky-300">€0.05/user</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
                                                    <div className="text-[11px] text-gray-400 mt-1">{option.audience} • priced by radius</div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-5 h-5 mt-0.5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeStep === 2 && (
                        <div className="space-y-3">
                            <h3 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Budget and duration</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Set how long this boost should run.</p>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Duration</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedDurationMeta.label}</p>
                                </div>
                                <div className="mt-3 px-1">
                                    <input
                                        type="range"
                                        min={0}
                                        max={durationOptions.length - 1}
                                        step={1}
                                        value={durationIndex}
                                        onChange={(e) => {
                                            const idx = Number(e.target.value);
                                            const next = durationOptions[idx];
                                            if (next) setSelectedDuration(next.hours);
                                        }}
                                        className="boost-slider"
                                        style={{ ['--fill' as any]: `${durationFillPercent}%` }}
                                        aria-label="Boost duration"
                                    />
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                        {durationOptions.map((duration) => (
                                            <span
                                                key={duration.hours}
                                                className={selectedDuration === duration.hours ? 'text-sky-600 dark:text-sky-300 font-semibold' : ''}
                                            >
                                                {duration.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white/95 dark:bg-[#0b0b0f]/95 backdrop-blur border-t border-gray-200 dark:border-white/10 px-5 py-4 rounded-b-3xl">
                    <div className="mb-3 rounded-2xl border border-gray-200 dark:border-white/10 p-3 bg-gray-50/80 dark:bg-white/[0.03]">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Audience</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{estimatedReach}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Duration</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedDurationMeta.hours}h</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Ad budget</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {estimatedTotalPrice != null ? `€${estimatedTotalPrice.toFixed(2)}` : '--'}
                            </span>
                        </div>
                        {estimateLoading && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Calculating audience...</p>
                        )}
                        {estimateError && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{estimateError}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2) : prev))}
                            disabled={activeStep === 1}
                            className={`w-24 py-3 rounded-xl font-semibold text-sm border transition-colors ${
                                activeStep === 1
                                    ? 'border-gray-200 dark:border-white/10 text-gray-400 cursor-not-allowed'
                                    : 'border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            Back
                        </button>
                        {activeStep < 2 ? (
                            <button
                                type="button"
                                onClick={() => setActiveStep((prev) => (prev < 2 ? ((prev + 1) as 1 | 2) : prev))}
                                disabled={(activeStep === 1 && !selectedOption)}
                                className={`flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                                    activeStep === 1 && !selectedOption
                                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                        : 'bg-sky-500 hover:bg-sky-600 active:scale-[0.99]'
                                }`}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!canContinue}
                                className={`flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                                    canContinue
                                        ? 'bg-sky-500 hover:bg-sky-600 active:scale-[0.99]'
                                        : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                }`}
                            >
                                Continue to Payment
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                        {selectedOption ? (
                            estimateLoading ? (
                                'Calculating audience...'
                            ) : estimatedTotalPrice != null && estimatedTotalPrice > 0 ? (
                                `Estimated total: €${estimatedTotalPrice.toFixed(2)} • Secure payment`
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

