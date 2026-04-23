import React from 'react';
import { FiCheckCircle, FiInfo, FiX, FiZap } from 'react-icons/fi';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { estimateBoostPriceApi, updateAuthProfile } from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';

export type BoostFeedType = 'local' | 'regional' | 'national';
export type BoostGoal = 'views' | 'profile_visits' | 'messages';
export type BoostDuration = 6 | 12 | 24 | 72;

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
const MIN_ELIGIBLE_AUDIENCE = 100;
const DEFAULT_LOCAL_BOUNDARY_KM = 2;
const DEFAULT_REGIONAL_BOUNDARY_KM = 6;

export default function BoostSelectionModal({
    isOpen,
    post,
    onClose,
    onSelect
}: BoostSelectionModalProps) {
    const [selectedDuration, setSelectedDuration] = React.useState<BoostDuration>(6);
    const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1);
    const [radiusKm, setRadiusKm] = React.useState<number>(2);
    const [localBoundaryKm, setLocalBoundaryKm] = React.useState<number>(() => {
        try {
            const raw = localStorage.getItem('clips:boostLocalBoundaryKm');
            const parsed = raw ? Number(raw) : NaN;
            return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCAL_BOUNDARY_KM;
        } catch {
            return DEFAULT_LOCAL_BOUNDARY_KM;
        }
    });
    const [regionalBoundaryKm, setRegionalBoundaryKm] = React.useState<number>(() => {
        try {
            const raw = localStorage.getItem('clips:boostRegionalBoundaryKm');
            const parsed = raw ? Number(raw) : NaN;
            return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REGIONAL_BOUNDARY_KM;
        } catch {
            return DEFAULT_REGIONAL_BOUNDARY_KM;
        }
    });
    const [eligibleUsersCount, setEligibleUsersCount] = React.useState<number | null>(null);
    const [estimatedTotalPrice, setEstimatedTotalPrice] = React.useState<number | null>(null);
    const [estimateLoading, setEstimateLoading] = React.useState(false);
    const [estimateError, setEstimateError] = React.useState<string | null>(null);
    const [showAdvancedBoundaries, setShowAdvancedBoundaries] = React.useState(false);
    const [debouncedRadiusKm, setDebouncedRadiusKm] = React.useState<number>(2);
    const [sliderRadiusKm, setSliderRadiusKm] = React.useState<number>(2);
    const [isSliderDragging, setIsSliderDragging] = React.useState(false);

    const { user } = useAuth();

    const selectedDurationMeta = durationOptions.find((d) => d.hours === selectedDuration) ?? durationOptions[0];

    const estimatedReach = eligibleUsersCount != null ? `${eligibleUsersCount.toLocaleString()} users` : '--';
    const durationIndex = Math.max(0, durationOptions.findIndex((d) => d.hours === selectedDuration));
    const effectiveLocalBoundary = Math.max(0.5, Number.isFinite(localBoundaryKm) ? localBoundaryKm : DEFAULT_LOCAL_BOUNDARY_KM);
    const effectiveRegionalBoundary = Math.max(
        effectiveLocalBoundary + 0.5,
        Number.isFinite(regionalBoundaryKm) ? regionalBoundaryKm : DEFAULT_REGIONAL_BOUNDARY_KM
    );
    // Keep slider scale stable while dragging to avoid visual jumpiness.
    const sliderMax = Math.max(25, Math.ceil(effectiveRegionalBoundary * 2));
    const clampedForSlider = Math.min(Math.max(0.5, sliderRadiusKm), sliderMax);
    const radiusFillPercent = (clampedForSlider / Math.max(1, sliderMax)) * 100;
    const durationFillPercent = (durationIndex / Math.max(1, durationOptions.length - 1)) * 100;
    const selectedOption: BoostFeedType =
        radiusKm <= effectiveLocalBoundary ? 'local' : radiusKm <= effectiveRegionalBoundary ? 'regional' : 'national';
    const debouncedSelectedOption: BoostFeedType =
        debouncedRadiusKm <= effectiveLocalBoundary
            ? 'local'
            : debouncedRadiusKm <= effectiveRegionalBoundary
                ? 'regional'
                : 'national';
    const derivedAudienceLabel = selectedOption === 'local'
        ? 'Local audience'
        : selectedOption === 'regional'
            ? 'Regional audience'
            : 'National audience';
    const isBusinessAccount = user?.accountType === 'business';
    const eligibleTooLow =
        typeof eligibleUsersCount === 'number' &&
        eligibleUsersCount > 0 &&
        eligibleUsersCount < MIN_ELIGIBLE_AUDIENCE;
    const suggestedRadiusKm = React.useMemo(() => {
        if (!eligibleTooLow || !eligibleUsersCount || radiusKm <= 0) return null;
        const ratio = MIN_ELIGIBLE_AUDIENCE / Math.max(1, eligibleUsersCount);
        const next = Math.max(radiusKm + 0.5, radiusKm * ratio);
        return Number((Math.ceil(next * 2) / 2).toFixed(1));
    }, [eligibleTooLow, eligibleUsersCount, radiusKm]);
    const canContinue =
        estimatedTotalPrice != null &&
        estimatedTotalPrice > 0 &&
        !eligibleTooLow &&
        !estimateLoading;
    const currentStep = activeStep;
    const totalSteps = 3;

    React.useEffect(() => {
        try {
            localStorage.setItem('clips:boostLocalBoundaryKm', String(effectiveLocalBoundary));
            localStorage.setItem('clips:boostRegionalBoundaryKm', String(effectiveRegionalBoundary));
        } catch {
            /* ignore */
        }
    }, [effectiveLocalBoundary, effectiveRegionalBoundary]);

    React.useEffect(() => {
        if (!isOpen) return;
        const hasCustomBoundaries =
            Math.abs(effectiveLocalBoundary - DEFAULT_LOCAL_BOUNDARY_KM) > 0.001 ||
            Math.abs(effectiveRegionalBoundary - DEFAULT_REGIONAL_BOUNDARY_KM) > 0.001;
        setShowAdvancedBoundaries(hasCustomBoundaries);
    }, [isOpen, effectiveLocalBoundary, effectiveRegionalBoundary]);

    React.useEffect(() => {
        if (!isOpen) return;
        setDebouncedRadiusKm(radiusKm);
    }, [isOpen, radiusKm]);

    React.useEffect(() => {
        if (isSliderDragging) return;
        setSliderRadiusKm(radiusKm);
    }, [radiusKm, isSliderDragging]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedRadiusKm(radiusKm);
        }, 180);
        return () => window.clearTimeout(timer);
    }, [radiusKm]);

    const commitSliderRadius = React.useCallback(() => {
        setIsSliderDragging(false);
        const next = Number(sliderRadiusKm.toFixed(1));
        if (Number.isFinite(next) && next > 0 && next !== radiusKm) {
            setRadiusKm(next);
        }
    }, [sliderRadiusKm, radiusKm]);

    React.useEffect(() => {
        const useLaravel = isLaravelApiEnabled();
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
        if (!useLaravel || !token || !user?.id) return;
        const timer = window.setTimeout(() => {
            void updateAuthProfile({
                // Best-effort server persistence for cross-device consistency.
                boost_local_boundary_km: Number(effectiveLocalBoundary.toFixed(1)),
                boost_regional_boundary_km: Number(effectiveRegionalBoundary.toFixed(1)),
            } as any).catch(() => {
                /* ignore */
            });
        }, 700);
        return () => window.clearTimeout(timer);
    }, [user?.id, effectiveLocalBoundary, effectiveRegionalBoundary]);

    const handleSubmit = () => {
        if (eligibleUsersCount == null || estimatedTotalPrice == null) return;
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
            if (!user?.id || !debouncedRadiusKm || debouncedRadiusKm <= 0) {
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
                        feedType: debouncedSelectedOption,
                        userId: user.id,
                        radiusKm: debouncedRadiusKm,
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
                    const eligible = Math.max(0, Math.round(baseByFeed[debouncedSelectedOption] * (debouncedRadiusKm / 2)));
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
    }, [debouncedSelectedOption, user?.id, debouncedRadiusKm, selectedDuration]);

    if (!isOpen || !post) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md h-[min(92vh,760px)] bg-white dark:bg-[#0b0b0f] rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden border border-black/10 dark:border-white/10 flex flex-col"
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
                <div className="bg-white/95 dark:bg-[#0b0b0f]/95 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-5 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3 rounded-t-3xl">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                                <FiZap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 dark:text-sky-300" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Boost post</h2>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Step {currentStep} of {totalSteps}</p>
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
                                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            />
                        </div>
                        <div className="mt-2 grid grid-cols-3 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <span className={currentStep >= 1 ? 'text-gray-900 dark:text-white' : ''}>Overview</span>
                            <span className={currentStep >= 2 ? 'text-gray-900 dark:text-white text-center' : 'text-center'}>Audience</span>
                            <span className={currentStep >= 3 ? 'text-gray-900 dark:text-white text-right' : 'text-right'}>Budget & time</span>
                        </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5 sm:gap-2">
                        <span className="inline-flex items-center rounded-full border border-sky-200 dark:border-sky-500/30 bg-sky-50/80 dark:bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-200">
                            Radius: {radiusKm} km
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/15 bg-gray-50/80 dark:bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                            Tier: {derivedAudienceLabel}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/15 bg-gray-50/80 dark:bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                            Duration: {selectedDurationMeta.label}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4">
                    {activeStep === 1 && (
                        <div className="space-y-2.5 sm:space-y-3">
                            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Boost overview</h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Review what this boost does before choosing your audience.</p>
                            <div className="rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/80 dark:bg-sky-500/10 p-3">
                                <div className="flex items-center gap-2">
                                    <FiInfo className="h-4 w-4 text-sky-700 dark:text-sky-300 shrink-0" />
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800 dark:text-sky-200">
                                        Boost Benefits
                                    </p>
                                </div>
                                <ul className="mt-2 space-y-1.5 text-xs text-gray-700 dark:text-gray-200">
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="h-3.5 w-3.5 mt-0.5 text-sky-600 dark:text-sky-300 shrink-0" />
                                        <span>Appear across more feeds based on your selected radius and campaign duration.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="h-3.5 w-3.5 mt-0.5 text-sky-600 dark:text-sky-300 shrink-0" />
                                        <span>See estimated audience reach before payment so you can adjust radius for better results.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="h-3.5 w-3.5 mt-0.5 text-sky-600 dark:text-sky-300 shrink-0" />
                                        <span>
                                            {isBusinessAccount
                                                ? 'Business account: eligible for local business suggested card placements.'
                                                : 'Personal account: not eligible for local business suggested card placements.'}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03] p-3">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Next: pick your audience radius</p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    You will choose exact radius and boundary thresholds in the next step.
                                </p>
                            </div>
                        </div>
                    )}
                    {activeStep === 2 && (
                        <div className="space-y-2.5 sm:space-y-3">
                            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Select audience radius</h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Use KM targeting to control how far this boost reaches.</p>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-2.5 sm:p-3 mt-1">
                                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Radius</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{radiusKm} km</p>
                                </div>
                                <div className="px-1">
                                    <input
                                        type="range"
                                        min={0.5}
                                        max={sliderMax}
                                        step={0.5}
                                        value={Math.min(Math.max(0.5, sliderRadiusKm), sliderMax)}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            if (!Number.isFinite(next) || next <= 0) return;
                                            setSliderRadiusKm(next);
                                            // Keyboard and non-pointer changes should still apply immediately.
                                            if (!isSliderDragging) {
                                                setRadiusKm(next);
                                            }
                                        }}
                                        onPointerDown={() => setIsSliderDragging(true)}
                                        onPointerUp={commitSliderRadius}
                                        onPointerCancel={commitSliderRadius}
                                        onBlur={commitSliderRadius}
                                        className="boost-slider"
                                        style={{ ['--fill' as any]: `${radiusFillPercent}%` }}
                                        aria-label="Radius in kilometers"
                                    />
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                        <span>0.5 km</span>
                                        <span>{sliderMax} km</span>
                                    </div>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
                                    <div>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Exact radius (km)</p>
                                        <input
                                            type="number"
                                            min={0.5}
                                            step={0.5}
                                            value={Number.isFinite(radiusKm) ? radiusKm : 0.5}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                if (!Number.isFinite(next) || next <= 0) return;
                                                setRadiusKm(next);
                                            }}
                                            className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setRadiusKm((prev) => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
                                            className="rounded-xl border border-gray-200 dark:border-white/10 px-2 py-1.5 sm:py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                                        >
                                            -0.5
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRadiusKm((prev) => Number((prev + 0.5).toFixed(1)))}
                                            className="rounded-xl border border-gray-200 dark:border-white/10 px-2 py-1.5 sm:py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                                        >
                                            +0.5
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03] p-2.5 sm:p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Audience tier</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{derivedAudienceLabel}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedBoundaries((prev) => !prev)}
                                    className="mt-2 inline-flex items-center rounded-lg border border-gray-200 dark:border-white/15 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                                >
                                    {showAdvancedBoundaries ? 'Hide advanced boundaries' : 'Show advanced boundaries'}
                                </button>
                                {showAdvancedBoundaries && (
                                    <>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Feed tier is derived from your boundaries: local up to {effectiveLocalBoundary}km, regional up to {effectiveRegionalBoundary}km.
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Local boundary (km)</p>
                                                <input
                                                    type="number"
                                                    min={0.5}
                                                    step={0.5}
                                                    value={effectiveLocalBoundary}
                                                    onChange={(e) => {
                                                        const next = Number(e.target.value);
                                                        if (!Number.isFinite(next) || next <= 0) return;
                                                        setLocalBoundaryKm(next);
                                                    }}
                                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Regional boundary (km)</p>
                                                <input
                                                    type="number"
                                                    min={effectiveLocalBoundary + 0.5}
                                                    step={0.5}
                                                    value={effectiveRegionalBoundary}
                                                    onChange={(e) => {
                                                        const next = Number(e.target.value);
                                                        if (!Number.isFinite(next) || next <= 0) return;
                                                        setRegionalBoundaryKm(next);
                                                    }}
                                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeStep === 3 && (
                        <div className="space-y-2.5 sm:space-y-3">
                            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Budget and duration</h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Set how long this boost should run.</p>
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-2.5 sm:p-3">
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
                <div className="bg-white/95 dark:bg-[#0b0b0f]/95 backdrop-blur border-t border-gray-200 dark:border-white/10 px-4 sm:px-5 py-3 sm:py-4 rounded-b-3xl">
                    <div className="mb-2.5 sm:mb-3 rounded-2xl border border-gray-200 dark:border-white/10 p-2.5 sm:p-3 bg-gray-50/80 dark:bg-white/[0.03]">
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
                        {eligibleTooLow && (
                            <div className="mt-2 rounded-xl border border-amber-300/50 bg-amber-50/70 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                                <p>Audience is below minimum ({MIN_ELIGIBLE_AUDIENCE} users) for this radius.</p>
                                {suggestedRadiusKm != null && (
                                    <button
                                        type="button"
                                        onClick={() => setRadiusKm(suggestedRadiusKm)}
                                        className="mt-1 inline-flex items-center rounded-lg border border-amber-400/50 px-2 py-1 font-semibold hover:bg-amber-100/70 dark:hover:bg-amber-400/10"
                                    >
                                        Try {suggestedRadiusKm} km
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))}
                            disabled={activeStep === 1}
                            className={`w-20 sm:w-24 py-2.5 sm:py-3 rounded-xl font-semibold text-sm border transition-colors ${
                                activeStep === 1
                                    ? 'border-gray-200 dark:border-white/10 text-gray-400 cursor-not-allowed'
                                    : 'border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            Back
                        </button>
                        {activeStep < totalSteps ? (
                            <button
                                type="button"
                                onClick={() => setActiveStep((prev) => (prev < totalSteps ? ((prev + 1) as 1 | 2 | 3) : prev))}
                                disabled={false}
                                className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                                    'bg-sky-500 hover:bg-sky-600 active:scale-[0.99]'
                                }`}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!canContinue}
                                className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
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
                        {estimateLoading ? (
                            'Calculating audience...'
                        ) : estimatedTotalPrice != null && estimatedTotalPrice > 0 ? (
                            `Estimated total: €${estimatedTotalPrice.toFixed(2)} • Secure payment`
                        ) : (
                            'No eligible audience found for this radius'
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

