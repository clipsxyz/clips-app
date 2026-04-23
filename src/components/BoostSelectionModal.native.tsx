import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
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
    onSelect,
}: BoostSelectionModalProps) {
    const { user } = useAuth();
    const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1);
    const [selectedDuration, setSelectedDuration] = React.useState<BoostDuration>(6);
    const [radiusKm, setRadiusKm] = React.useState<number>(2);
    const [localBoundaryKm, setLocalBoundaryKm] = React.useState<number>(DEFAULT_LOCAL_BOUNDARY_KM);
    const [regionalBoundaryKm, setRegionalBoundaryKm] = React.useState<number>(DEFAULT_REGIONAL_BOUNDARY_KM);
    const [showAdvancedBoundaries, setShowAdvancedBoundaries] = React.useState(false);
    const [eligibleUsersCount, setEligibleUsersCount] = React.useState<number | null>(null);
    const [estimatedTotalPrice, setEstimatedTotalPrice] = React.useState<number | null>(null);
    const [estimateLoading, setEstimateLoading] = React.useState(false);
    const [estimateError, setEstimateError] = React.useState<string | null>(null);
    const [debouncedRadiusKm, setDebouncedRadiusKm] = React.useState<number>(2);
    const [sliderRadiusKm, setSliderRadiusKm] = React.useState<number>(2);
    const [isSliderDragging, setIsSliderDragging] = React.useState(false);

    const effectiveLocalBoundary = Math.max(0.5, Number.isFinite(localBoundaryKm) ? localBoundaryKm : DEFAULT_LOCAL_BOUNDARY_KM);
    const effectiveRegionalBoundary = Math.max(
        effectiveLocalBoundary + 0.5,
        Number.isFinite(regionalBoundaryKm) ? regionalBoundaryKm : DEFAULT_REGIONAL_BOUNDARY_KM
    );

    const selectedOption: BoostFeedType =
        radiusKm <= effectiveLocalBoundary ? 'local' : radiusKm <= effectiveRegionalBoundary ? 'regional' : 'national';
    const debouncedSelectedOption: BoostFeedType =
        debouncedRadiusKm <= effectiveLocalBoundary
            ? 'local'
            : debouncedRadiusKm <= effectiveRegionalBoundary
                ? 'regional'
                : 'national';
    const derivedAudienceLabel =
        selectedOption === 'local' ? 'Local audience' : selectedOption === 'regional' ? 'Regional audience' : 'National audience';
    const selectedDurationMeta = durationOptions.find((d) => d.hours === selectedDuration) ?? durationOptions[0];
    const estimatedReach = eligibleUsersCount != null ? `${eligibleUsersCount.toLocaleString()} users` : '--';
    const eligibleTooLow =
        typeof eligibleUsersCount === 'number' &&
        eligibleUsersCount > 0 &&
        eligibleUsersCount < MIN_ELIGIBLE_AUDIENCE;
    const canContinue = estimatedTotalPrice != null && estimatedTotalPrice > 0 && !eligibleTooLow && !estimateLoading;

    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [rawLocal, rawRegional] = await Promise.all([
                    AsyncStorage.getItem('clips:boostLocalBoundaryKm'),
                    AsyncStorage.getItem('clips:boostRegionalBoundaryKm'),
                ]);
                if (cancelled) return;
                const parsedLocal = rawLocal ? Number(rawLocal) : NaN;
                const parsedRegional = rawRegional ? Number(rawRegional) : NaN;
                if (Number.isFinite(parsedLocal) && parsedLocal > 0) setLocalBoundaryKm(parsedLocal);
                if (Number.isFinite(parsedRegional) && parsedRegional > 0) setRegionalBoundaryKm(parsedRegional);
            } catch {
                // no-op
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        void AsyncStorage.multiSet([
            ['clips:boostLocalBoundaryKm', String(effectiveLocalBoundary)],
            ['clips:boostRegionalBoundaryKm', String(effectiveRegionalBoundary)],
        ]).catch(() => {});
    }, [effectiveLocalBoundary, effectiveRegionalBoundary]);

    React.useEffect(() => {
        if (!isOpen) return;
        setActiveStep(1);
        const hasCustomBoundaries =
            Math.abs(effectiveLocalBoundary - DEFAULT_LOCAL_BOUNDARY_KM) > 0.001 ||
            Math.abs(effectiveRegionalBoundary - DEFAULT_REGIONAL_BOUNDARY_KM) > 0.001;
        setShowAdvancedBoundaries(hasCustomBoundaries);
    }, [isOpen, effectiveLocalBoundary, effectiveRegionalBoundary]);

    React.useEffect(() => {
        if (!isOpen) return;
        setDebouncedRadiusKm(radiusKm);
        setSliderRadiusKm(radiusKm);
    }, [isOpen, radiusKm]);

    React.useEffect(() => {
        if (isSliderDragging) return;
        setSliderRadiusKm(radiusKm);
    }, [radiusKm, isSliderDragging]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedRadiusKm(radiusKm);
        }, 180);
        return () => clearTimeout(timer);
    }, [radiusKm]);

    React.useEffect(() => {
        const useLaravel = isLaravelApiEnabled();
        if (!useLaravel || !user?.id) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void AsyncStorage.getItem('authToken')
                .then((token) => {
                    if (!token || cancelled) return;
                    return updateAuthProfile({
                        boost_local_boundary_km: Number(effectiveLocalBoundary.toFixed(1)),
                        boost_regional_boundary_km: Number(effectiveRegionalBoundary.toFixed(1)),
                    } as any);
                })
                .catch(() => {});
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [user?.id, effectiveLocalBoundary, effectiveRegionalBoundary]);

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
                    setEligibleUsersCount(typeof res.eligibleUsersCount === 'number' ? res.eligibleUsersCount : null);
                    setEstimatedTotalPrice(typeof res.priceEur === 'number' ? res.priceEur : null);
                } else {
                    const baseByFeed: Record<BoostFeedType, number> = { local: 1200, regional: 2600, national: 5400 };
                    const multiplier = durationOptions.find((d) => d.hours === selectedDuration)?.multiplier ?? 1;
                    const eligible = Math.max(0, Math.round(baseByFeed[debouncedSelectedOption] * (debouncedRadiusKm / 2)));
                    const price = Number((eligible * 0.05 * multiplier).toFixed(2));
                    if (cancelled) return;
                    setEligibleUsersCount(eligible);
                    setEstimatedTotalPrice(price);
                }
            } catch (e: any) {
                if (cancelled) return;
                setEstimateError(e?.message ?? 'Could not estimate boost');
                setEligibleUsersCount(null);
                setEstimatedTotalPrice(null);
            } finally {
                if (!cancelled) setEstimateLoading(false);
            }
        }

        void run();
        return () => {
            cancelled = true;
        };
    }, [debouncedRadiusKm, debouncedSelectedOption, selectedDuration, user?.id]);

    if (!isOpen || !post) return null;

    const handleSubmit = () => {
        if (eligibleUsersCount == null || estimatedTotalPrice == null || estimatedTotalPrice <= 0) return;
        onSelect(selectedOption, estimatedTotalPrice, {
            goal: 'views',
            durationHours: selectedDuration,
            estimatedReach,
            radiusKm,
            eligibleUsersCount,
        });
    };

    const adjustRadius = (delta: number) => {
        setRadiusKm((prev) => Math.max(0.5, Number((prev + delta).toFixed(1))));
    };

    const commitSliderRadius = React.useCallback((value?: number) => {
        setIsSliderDragging(false);
        const source = typeof value === 'number' ? value : sliderRadiusKm;
        const next = Number(source.toFixed(1));
        if (Number.isFinite(next) && next > 0 && next !== radiusKm) {
            setRadiusKm(next);
        }
    }, [sliderRadiusKm, radiusKm]);

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Boost post</Text>
                        <Text style={styles.stepText}>Step {activeStep} of 3</Text>
                        <View style={styles.chips}>
                            <Text style={styles.chip}>Radius: {radiusKm} km</Text>
                            <Text style={styles.chip}>Tier: {derivedAudienceLabel}</Text>
                            <Text style={styles.chip}>Duration: {selectedDurationMeta.label}</Text>
                        </View>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                        {activeStep === 1 && (
                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Boost overview</Text>
                                <Text style={styles.sectionMuted}>Reach more people based on radius and duration.</Text>
                                <Text style={styles.bullet}>- Appears across more feeds based on selected radius.</Text>
                                <Text style={styles.bullet}>- Audience and budget are estimated before payment.</Text>
                                <Text style={styles.bullet}>
                                    - {user?.accountType === 'business' ? 'Business account enabled for local business placements.' : 'Personal account (no business placement).'}
                                </Text>
                            </View>
                        )}

                        {activeStep === 2 && (
                            <>
                                <View style={styles.card}>
                                    <Text style={styles.sectionTitle}>Select audience radius</Text>
                                    <Text style={styles.metric}>{radiusKm} km</Text>
                                    <Slider
                                        minimumValue={0.5}
                                        maximumValue={Math.max(25, Math.ceil(effectiveRegionalBoundary * 2))}
                                        step={0.5}
                                        value={Math.max(0.5, sliderRadiusKm)}
                                        onSlidingStart={() => setIsSliderDragging(true)}
                                        onValueChange={(value) => setSliderRadiusKm(Number(value))}
                                        onSlidingComplete={(value) => {
                                            commitSliderRadius(Number(value));
                                        }}
                                        minimumTrackTintColor="#0EA5E9"
                                        maximumTrackTintColor="rgba(148,163,184,0.45)"
                                        thumbTintColor="#FFFFFF"
                                    />
                                    <View style={styles.row}>
                                        <Pressable style={styles.smallBtn} onPress={() => adjustRadius(-0.5)}>
                                            <Text style={styles.smallBtnText}>-0.5</Text>
                                        </Pressable>
                                        <Pressable style={styles.smallBtn} onPress={() => adjustRadius(0.5)}>
                                            <Text style={styles.smallBtnText}>+0.5</Text>
                                        </Pressable>
                                    </View>
                                    <TextInput
                                        value={String(radiusKm)}
                                        keyboardType="numeric"
                                        onChangeText={(txt) => {
                                            const next = Number(txt);
                                            if (Number.isFinite(next) && next > 0) setRadiusKm(next);
                                        }}
                                        style={styles.input}
                                        placeholder="Exact radius in km"
                                        placeholderTextColor="#6B7280"
                                    />
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.sectionTitle}>Audience tier: {derivedAudienceLabel}</Text>
                                    <Pressable style={styles.toggleBtn} onPress={() => setShowAdvancedBoundaries((prev) => !prev)}>
                                        <Text style={styles.toggleBtnText}>{showAdvancedBoundaries ? 'Hide advanced boundaries' : 'Show advanced boundaries'}</Text>
                                    </Pressable>
                                    {showAdvancedBoundaries && (
                                        <>
                                            <TextInput
                                                value={String(effectiveLocalBoundary)}
                                                keyboardType="numeric"
                                                onChangeText={(txt) => {
                                                    const next = Number(txt);
                                                    if (Number.isFinite(next) && next > 0) setLocalBoundaryKm(next);
                                                }}
                                                style={styles.input}
                                                placeholder="Local boundary (km)"
                                                placeholderTextColor="#6B7280"
                                            />
                                            <TextInput
                                                value={String(effectiveRegionalBoundary)}
                                                keyboardType="numeric"
                                                onChangeText={(txt) => {
                                                    const next = Number(txt);
                                                    if (Number.isFinite(next) && next > 0) setRegionalBoundaryKm(next);
                                                }}
                                                style={styles.input}
                                                placeholder="Regional boundary (km)"
                                                placeholderTextColor="#6B7280"
                                            />
                                        </>
                                    )}
                                </View>
                            </>
                        )}

                        {activeStep === 3 && (
                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Budget and duration</Text>
                                <View style={styles.rowWrap}>
                                    {durationOptions.map((opt) => {
                                        const active = selectedDuration === opt.hours;
                                        return (
                                            <Pressable
                                                key={opt.hours}
                                                style={[styles.durationBtn, active && styles.durationBtnActive]}
                                                onPress={() => setSelectedDuration(opt.hours)}
                                            >
                                                <Text style={[styles.durationBtnText, active && styles.durationBtnTextActive]}>{opt.label}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <Text style={styles.footerLine}>Audience: {estimatedReach}</Text>
                        <Text style={styles.footerLine}>Duration: {selectedDurationMeta.hours}h</Text>
                        <Text style={styles.footerLine}>
                            Ad budget: {estimatedTotalPrice != null ? `EUR ${estimatedTotalPrice.toFixed(2)}` : '--'}
                        </Text>
                        {estimateLoading && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color="#38BDF8" />
                                <Text style={styles.footerMuted}>Calculating audience...</Text>
                            </View>
                        )}
                        {!!estimateError && <Text style={styles.errorText}>{estimateError}</Text>}
                        {eligibleTooLow && (
                            <Text style={styles.warnText}>
                                Audience is below minimum ({MIN_ELIGIBLE_AUDIENCE} users). Increase radius.
                            </Text>
                        )}

                        <View style={styles.actions}>
                            <Pressable
                                style={[styles.navBtn, activeStep === 1 && styles.navBtnDisabled]}
                                disabled={activeStep === 1}
                                onPress={() => setActiveStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                            >
                                <Text style={styles.navBtnText}>Back</Text>
                            </Pressable>
                            {activeStep < 3 ? (
                                <Pressable style={[styles.primaryBtn]} onPress={() => setActiveStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}>
                                    <Text style={styles.primaryBtnText}>Next</Text>
                                </Pressable>
                            ) : (
                                <Pressable style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]} disabled={!canContinue} onPress={handleSubmit}>
                                    <Text style={styles.primaryBtnText}>Continue to payment</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '92%',
        backgroundColor: '#0B0B0F',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    title: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
    stepText: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chip: {
        color: '#BAE6FD',
        fontSize: 11,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.35)',
        backgroundColor: 'rgba(14,165,233,0.12)',
    },
    body: { flexGrow: 0 },
    bodyContent: { padding: 14, gap: 10 },
    card: {
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 8,
    },
    sectionTitle: { color: '#F3F4F6', fontSize: 16, fontWeight: '700' },
    sectionMuted: { color: '#9CA3AF', fontSize: 12 },
    bullet: { color: '#D1D5DB', fontSize: 12 },
    metric: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    smallBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    smallBtnText: { color: '#E5E7EB', fontWeight: '700' },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: '#0F1117',
        color: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    toggleBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    toggleBtnText: { color: '#E5E7EB', fontSize: 12, fontWeight: '700' },
    durationBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    durationBtnActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.16)' },
    durationBtnText: { color: '#D1D5DB', fontWeight: '600' },
    durationBtnTextActive: { color: '#E0F2FE' },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        gap: 4,
    },
    footerLine: { color: '#D1D5DB', fontSize: 13 },
    footerMuted: { color: '#9CA3AF', fontSize: 12 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
    errorText: { color: '#FCA5A5', fontSize: 12, marginTop: 4 },
    warnText: { color: '#FCD34D', fontSize: 12, marginTop: 4 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    navBtn: {
        width: 84,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 12,
    },
    navBtnDisabled: { opacity: 0.45 },
    navBtnText: { color: '#E5E7EB', fontWeight: '700' },
    primaryBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#0EA5E9',
        paddingVertical: 12,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});

