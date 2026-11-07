import React from 'react';
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { estimateBoostPriceApi, updateAuthProfile, apiRequest } from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { confirmBoostCheckout } from '../api/boost';
import { openStripeCheckout } from '../utils/stripeCheckoutNative';
import { boostQuoteCents, BOOST_UNIT_PRICE_EUR, type BoostGateway } from '../utils/boostQuote';
import { boostStoreSku } from '../config/boostStoreProducts';
import { purchaseBoostWithStore } from '../services/storeBilling';
import { BOOST_ACTIVATED_EVENT } from './BoostActivatedModal.native';
import { BOOST_STATUS_REFRESH_EVENT } from '../navigation/linking';
import BoostWizardBottomSheet from './BoostWizardBottomSheet.native';

export type BoostFeedType = 'local' | 'regional' | 'national';
export type BoostGoal = 'views' | 'profile_visits' | 'messages';
export type BoostDuration = 6 | 12 | 24 | 72;

interface BoostSelectionModalProps {
    isOpen: boolean;
    post?: Post | null;
    selectedPost?: Post | null;
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
    { hours: 12, label: '12h', multiplier: 1.5 },
    { hours: 24, label: '24h', multiplier: 2.2 },
    { hours: 72, label: '3d', multiplier: 4 },
];

const MIN_ELIGIBLE_AUDIENCE = 100;

const EXTERNAL_CHECKOUT_MESSAGE = 'You are leaving Gazetteer to make a purchase on external web checkout. Gazetteer Direct offers discounted rates.';

function confirmExternalWebCheckout(): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (accepted: boolean) => {
            if (settled) return;
            settled = true;
            resolve(accepted);
        };
        Alert.alert(
            'Gazetteer Direct',
            EXTERNAL_CHECKOUT_MESSAGE,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => finish(false) },
                { text: 'Continue to Web', onPress: () => finish(true) },
            ],
            { cancelable: true, onDismiss: () => finish(false) },
        );
    });
}

function storeBillingBanner(error: unknown): string {
    const tagged = error as { cancelled?: boolean; unavailable?: boolean; message?: string };
    if (tagged?.cancelled) return 'Payment cancelled. No charge was made.';
    if (tagged?.unavailable) return 'Store billing is unavailable right now.';
    const message = error instanceof Error ? error.message : 'Payment could not be completed.';
    if (/declin/i.test(message)) return 'Payment was declined. No charge was made.';
    if (/cancel/i.test(message)) return 'Payment cancelled. No charge was made.';
    if (/unavailable|not available|could not start/i.test(message)) return 'Store billing is unavailable right now.';
    return message;
}
const DEFAULT_LOCAL_BOUNDARY_KM = 2;
const DEFAULT_REGIONAL_BOUNDARY_KM = 6;

export default function BoostSelectionModal({
    isOpen,
    post,
    selectedPost,
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
    const [gateway, setGateway] = React.useState<BoostGateway>('stripe');
    const [estimateLoading, setEstimateLoading] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [payError, setPayError] = React.useState<string | null>(null);
    const [payNotice, setPayNotice] = React.useState<string | null>(null);
    const [payBanner, setPayBanner] = React.useState<string | null>(null);
    const [estimateError, setEstimateError] = React.useState<string | null>(null);
    const [debouncedRadiusKm, setDebouncedRadiusKm] = React.useState<number>(2);
    const [sliderRadiusKm, setSliderRadiusKm] = React.useState<number>(2);
    const [isSliderDragging, setIsSliderDragging] = React.useState(false);

    const effectiveLocalBoundary = Math.max(0.5, Number.isFinite(localBoundaryKm) ? localBoundaryKm : DEFAULT_LOCAL_BOUNDARY_KM);
    const effectiveRegionalBoundary = Math.max(
        effectiveLocalBoundary + 0.5,
        Number.isFinite(regionalBoundaryKm) ? regionalBoundaryKm : DEFAULT_REGIONAL_BOUNDARY_KM
    );

    const tier: 'standard' | 'premium' | 'featured' =
        radiusKm <= effectiveLocalBoundary ? 'standard' : radiusKm <= effectiveRegionalBoundary ? 'premium' : 'featured';
    const radius = Math.max(1, radiusKm);
    const duration = selectedDuration;
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
    const multiplier = selectedDurationMeta.multiplier;
    const stripeCents = eligibleUsersCount == null ? null : boostQuoteCents(eligibleUsersCount, multiplier, 'stripe');
    const storeCents = eligibleUsersCount == null ? null : boostQuoteCents(eligibleUsersCount, multiplier, 'store');
    const selectedCents = gateway === 'store' ? storeCents : stripeCents;
    const estimatedTotalPrice = selectedCents == null ? null : selectedCents / 100;
    const savingsCents = stripeCents != null && storeCents != null ? storeCents - stripeCents : 0;
    const storeName = Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play';
    const storePayLabel = Platform.OS === 'ios' ? 'Pay with Apple' : 'Pay with Google Play';
    const savePercent = storeCents != null && storeCents > 0 && savingsCents > 0
        ? Math.round((savingsCents / storeCents) * 100)
        : 20;
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
                } else {
                    const baseByFeed: Record<BoostFeedType, number> = { local: 1200, regional: 2600, national: 5400 };
                    const eligible = Math.max(0, Math.round(baseByFeed[debouncedSelectedOption] * (debouncedRadiusKm / 2)));
                    if (cancelled) return;
                    setEligibleUsersCount(eligible);
                }
            } catch (e: any) {
                if (cancelled) return;
                setEstimateError(e?.message ?? 'Could not estimate boost');
                setEligibleUsersCount(null);
            } finally {
                if (!cancelled) setEstimateLoading(false);
            }
        }

        void run();
        return () => {
            cancelled = true;
        };
    }, [debouncedRadiusKm, debouncedSelectedOption, selectedDuration, user?.id]);

    const commitSliderRadius = React.useCallback((value?: number) => {
        setIsSliderDragging(false);
        const source = typeof value === 'number' ? value : sliderRadiusKm;
        const next = Number(source.toFixed(1));
        if (Number.isFinite(next) && next > 0 && next !== radiusKm) {
            setRadiusKm(next);
        }
    }, [sliderRadiusKm, radiusKm]);

    const activePost = selectedPost ?? post ?? null;
    if (!isOpen || !activePost) return null;

    const handleContinueToPayment = async () => {
        const postId = activePost.id;
        if (!postId || eligibleUsersCount == null || estimatedTotalPrice == null || estimatedTotalPrice <= 0 || isProcessing) return;
        if (gateway === 'stripe' && Platform.OS === 'ios') {
            const proceed = await confirmExternalWebCheckout();
            if (!proceed) return;
        }
        setIsProcessing(true);
        setPayError(null);
        setPayNotice(null);
        setPayBanner(null);
        try {
            const data = await apiRequest('/boosts/create-checkout-session', {
                method: 'POST',
                body: JSON.stringify({
                    post_id: postId,
                    radius,
                    tier,
                    duration,
                    gateway,
                }),
            }) as {
                gateway?: string;
                checkout_url?: string;
                session_id?: string;
                error?: string;
                amount_cents?: number;
                currency?: string;
                product_id?: string;
                metadata?: Record<string, string>;
            };
            if (data?.error) throw new Error(data.error);
            if (gateway === 'store') {
                const sku = boostStoreSku(duration);
                if (!sku || data.product_id !== sku) {
                    throw new Error('This boost length is not available in the store');
                }
                await purchaseBoostWithStore({
                    sku,
                    postId,
                    radius,
                    tier,
                    durationHours: duration,
                });
                Alert.alert('Boost is live', 'Your post is now boosted.');
                onClose();
                return;
            }
            const checkoutUrl = String(data?.checkout_url || '').trim();
            if (!checkoutUrl) throw new Error('Checkout link was not returned');
            const outcome = await openStripeCheckout(checkoutUrl);
            if (outcome.outcome === 'success') {
                const sessionId = outcome.sessionId || data.session_id;
                let feedType = selectedOption;
                if (sessionId) {
                    const confirmed = await confirmBoostCheckout(sessionId);
                    if (confirmed.feed_type) feedType = confirmed.feed_type;
                }
                onClose();
                DeviceEventEmitter.emit('boostActivated', { postId, feedType });
                DeviceEventEmitter.emit(BOOST_STATUS_REFRESH_EVENT, { sessionId });
                DeviceEventEmitter.emit(BOOST_ACTIVATED_EVENT);
            }
        } catch (error) {
            const message = storeBillingBanner(error);
            if (gateway === 'store') {
                setPayError(null);
                setPayBanner(message);
                if (Platform.OS === 'android') {
                    ToastAndroid.show(message, ToastAndroid.SHORT);
                }
            } else {
                setPayBanner(null);
                setPayError(message);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const adjustRadius = (delta: number) => {
        setRadiusKm((prev) => Math.max(0.5, Number((prev + delta).toFixed(1))));
    };

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, activeStep === 3 && styles.sheetCheckout]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Boost post</Text>
                        <BoostWizardBottomSheet selectedPost={activePost} />
                        <Text style={styles.stepText}>Step {activeStep} of 3</Text>
                        <View style={styles.chips}>
                            <Text style={styles.chip}>Radius: {radiusKm} km</Text>
                            <Text style={styles.chip}>Tier: {derivedAudienceLabel}</Text>
                            <Text style={styles.chip}>Duration: {selectedDurationMeta.label}</Text>
                        </View>
                    </View>

                    <ScrollView
                        style={[styles.body, activeStep === 3 && styles.bodyStepThree]}
                        contentContainerStyle={[styles.bodyContent, activeStep === 3 && styles.bodyContentCompact]}
                        showsVerticalScrollIndicator={activeStep !== 3}
                    >
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
                                        minimumTrackTintColor="#d91b5c"
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
                            <ScrollView
                                style={styles.stepThreeScroll}
                                contentContainerStyle={styles.stepThreeContent}
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled
                            >
                                <View style={styles.stepThreeCard}>
                                    <Text style={styles.stepThreeTitle}>Budget and duration</Text>
                                    <View style={styles.priceTable}>
                                        <View style={styles.priceRow}>
                                            <Text style={styles.priceHead}>Length</Text>
                                            <Text style={styles.priceHead}>Per person</Text>
                                            <Text style={[styles.priceHead, styles.priceTotal]}>Total</Text>
                                        </View>
                                        {durationOptions.map((opt) => {
                                            const active = selectedDuration === opt.hours;
                                            const rowCents = eligibleUsersCount == null
                                                ? null
                                                : boostQuoteCents(eligibleUsersCount, opt.multiplier, gateway);
                                            return (
                                                <Pressable
                                                    key={opt.hours}
                                                    style={[styles.priceRow, active && styles.priceRowActive]}
                                                    onPress={() => setSelectedDuration(opt.hours)}
                                                >
                                                    <Text style={[styles.priceCell, active && styles.priceCellActive]}>{opt.label}</Text>
                                                    <Text style={[styles.priceCell, active && styles.priceCellActive]}>
                                                        €{(BOOST_UNIT_PRICE_EUR[gateway] * opt.multiplier).toFixed(4)}
                                                    </Text>
                                                    <Text style={[styles.priceCell, styles.priceTotal, active && styles.priceCellActive]}>
                                                        {rowCents == null ? '--' : `€${(rowCents / 100).toFixed(2)}`}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    <Text style={styles.stepThreeTitle}>Choose how to pay</Text>
                                    <View style={styles.gatewayRow}>
                                        <Pressable
                                            style={[styles.gatewayCard, gateway === 'stripe' && styles.gatewayCardActive]}
                                            onPress={() => setGateway('stripe')}
                                        >
                                            {savingsCents > 0 ? (
                                                <View style={styles.savePillSlot}>
                                                    <Text style={styles.savePill}>{`SAVE €${(savingsCents / 100).toFixed(2)}`}</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.savePillSlot}>
                                                    <Text style={styles.savePill}>SAVE 20%</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.gatewayName, gateway === 'stripe' && styles.gatewayNameActive]}>Gazetteer Direct</Text>
                                            <Text style={styles.gatewayPrice}>{stripeCents == null ? '--' : `€${(stripeCents / 100).toFixed(2)}`}</Text>
                                            <Text style={styles.gatewayHint}>{`Credit / Debit Card • Save ${savePercent}%`}</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.gatewayCard, gateway === 'store' && styles.gatewayCardActive]}
                                            onPress={() => setGateway('store')}
                                        >
                                            <View style={styles.savePillSlot} />
                                            <Text style={[styles.gatewayName, gateway === 'store' && styles.gatewayNameActive]}>{storeName}</Text>
                                            <Text style={styles.gatewayPrice}>{storeCents == null ? '--' : `€${(storeCents / 100).toFixed(2)}`}</Text>
                                            <Text style={styles.gatewayHint}>Standard Store Billing</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </ScrollView>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <Text style={styles.footerLine}>Audience: {estimatedReach}</Text>
                        <Text style={styles.footerLine}>Duration: {selectedDurationMeta.hours}h</Text>
                        <Text style={styles.footerLine}>
                            Per person: EUR {(BOOST_UNIT_PRICE_EUR[gateway] * multiplier).toFixed(4)}
                        </Text>
                        <Text style={styles.footerLine}>
                            Ad budget: {estimatedTotalPrice != null ? `EUR ${estimatedTotalPrice.toFixed(2)}` : '--'}
                        </Text>
                        {estimateLoading && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color="#f472b6" />
                                <Text style={styles.footerMuted}>Calculating audience...</Text>
                            </View>
                        )}
                        {!!estimateError && <Text style={styles.errorText}>{estimateError}</Text>}
                        {!!payError && <Text style={styles.errorText}>{payError}</Text>}
                        {!!payBanner && (
                            <View style={styles.payBanner}>
                                <Text style={styles.payBannerText}>{payBanner}</Text>
                            </View>
                        )}
                        {!!payNotice && <Text style={styles.footerMuted}>{payNotice}</Text>}
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
                                <Pressable style={styles.nextBtn} onPress={() => setActiveStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}>
                                    <Text style={styles.primaryBtnText}>Next</Text>
                                </Pressable>
                            ) : (
                                <Pressable
                                    style={[styles.primaryBtn, (!canContinue || isProcessing) && styles.primaryBtnDisabled]}
                                    disabled={!canContinue || isProcessing}
                                    onPress={() => { void handleContinueToPayment(); }}
                                >
                                    <LinearGradient colors={['#d91b5c', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payGradient}>
                                        {isProcessing ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.primaryBtnText}>
                                                {gateway === 'store' ? storePayLabel : 'Continue with Gazetteer Direct'}
                                            </Text>
                                        )}
                                    </LinearGradient>
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
        backgroundColor: 'rgba(13,12,18,0.98)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    sheetCheckout: { height: '92%' },
    header: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    title: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
    stepText: { color: '#9CA3AF', fontSize: 11, marginTop: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chip: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    body: { flexGrow: 0 },
    bodyStepThree: { flexGrow: 1, flexShrink: 1 },
    bodyContent: { padding: 14, gap: 10 },
    bodyContentCompact: { padding: 8, gap: 0, flexGrow: 1 },
    stepThreeScroll: { flexGrow: 1 },
    stepThreeContent: { flexGrow: 1 },
    stepThreeCard: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 4,
    },
    stepThreeTitle: { color: '#F3F4F6', fontSize: 14, fontWeight: '700' },
    card: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 8,
    },
    sectionTitle: { color: '#F3F4F6', fontSize: 16, fontWeight: '700' },
    sectionMuted: { color: '#9CA3AF', fontSize: 12 },
    bullet: { color: '#D1D5DB', fontSize: 12 },
    metric: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    priceTable: { gap: 0 },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    priceRowActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
    priceHead: { flex: 1, color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
    priceCell: { flex: 1, color: '#E5E7EB', fontSize: 12 },
    priceCellActive: { color: '#FFFFFF', fontWeight: '700' },
    priceTotal: { textAlign: 'right' },
    gatewayRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    gatewayCard: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 8,
        paddingHorizontal: 8,
        gap: 2,
    },
    gatewayCardActive: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.12)' },
    savePillSlot: { minHeight: 18, justifyContent: 'center' },
    savePill: {
        alignSelf: 'flex-start',
        overflow: 'hidden',
        backgroundColor: '#10B981',
        color: '#052E1C',
        fontSize: 10,
        fontWeight: '800',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
    },
    gatewayName: { color: '#E5E7EB', fontSize: 13, fontWeight: '700' },
    gatewayNameActive: { color: '#FFFFFF' },
    gatewayPrice: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
    gatewayHint: { color: '#9CA3AF', fontSize: 11, lineHeight: 14 },
    smallBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    smallBtnText: { color: '#E5E7EB', fontWeight: '700' },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    toggleBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    toggleBtnText: { color: '#E5E7EB', fontSize: 12, fontWeight: '700' },
    durationBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    durationBtnActive: {
        borderColor: 'rgba(255,255,255,0.55)',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    durationBtnText: { color: '#D1D5DB', fontWeight: '600' },
    durationBtnTextActive: { color: '#FFFFFF' },
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
    payBanner: {
        marginTop: 6,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    payBannerText: { color: '#F3F4F6', fontSize: 12, lineHeight: 16 },
    warnText: { color: '#FCD34D', fontSize: 12, marginTop: 4 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    navBtn: {
        width: 84,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 12,
    },
    navBtnDisabled: { opacity: 0.45 },
    navBtnText: { color: '#E5E7EB', fontWeight: '700' },
    nextBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#d91b5c',
        paddingVertical: 12,
    },
    primaryBtn: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    payGradient: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
});

