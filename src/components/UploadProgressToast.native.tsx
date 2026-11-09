import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import {
    subscribeUploadOverlay,
    type UploadOverlayState,
} from '../utils/uploadOverlayNative';
import { cancelActiveVideoCompression } from '../utils/compressVideoForUploadNative';
import { cancelActiveFfmpeg } from '../utils/ffmpegNative';

const RING = 46;
const STROKE = 2.5;
const RING_R = (RING - STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function percentFromMessage(message: string): boolean {
    return /\d+\s*%/.test(message);
}

/**
 * One floating upload card. Optimizing, posting, and the live confirmation
 * stay in this shell so the feed underneath never reflows.
 */
export default function UploadProgressToast() {
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<UploadOverlayState | null>(null);
    const [displayPct, setDisplayPct] = useState(0);
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardY = useRef(new Animated.Value(8)).current;
    const contentOpacity = useRef(new Animated.Value(1)).current;
    const fractionAnim = useRef(new Animated.Value(0)).current;
    const indeterminate = useRef(new Animated.Value(0)).current;
    const shownPct = useRef(0);
    const enteredId = useRef<string | null>(null);
    const finishedId = useRef<string | null>(null);

    useEffect(() => subscribeUploadOverlay(setState), []);

    useEffect(() => {
        const sub = fractionAnim.addListener(({ value }) => {
            const next = Math.round(Math.max(0, Math.min(1, value)) * 100);
            if (next === shownPct.current) return;
            shownPct.current = next;
            setDisplayPct(next);
        });
        return () => fractionAnim.removeListener(sub);
    }, [fractionAnim]);

    useEffect(() => {
        if (!state || state.status !== 'uploading' || typeof state.fraction !== 'number') return;
        Animated.timing(fractionAnim, {
            toValue: state.fraction,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [fractionAnim, state?.fraction, state?.id, state?.status]);

    const showDeterminate = state?.status === 'uploading' && typeof state.fraction === 'number';

    useEffect(() => {
        if (!showDeterminate) return undefined;
        indeterminate.setValue(0);
        return undefined;
    }, [indeterminate, showDeterminate]);

    useEffect(() => {
        if (state?.status !== 'uploading' || showDeterminate) return undefined;
        indeterminate.setValue(0);
        const loop = Animated.loop(
            Animated.timing(indeterminate, {
                toValue: 1,
                duration: 1100,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [indeterminate, showDeterminate, state?.status, state?.id]);

    useEffect(() => {
        if (!state) {
            enteredId.current = null;
            finishedId.current = null;
            shownPct.current = 0;
            setDisplayPct(0);
            fractionAnim.setValue(0);
            return;
        }

        if (state.status === 'uploading') {
            finishedId.current = null;
            if (enteredId.current === state.id) return;
            enteredId.current = state.id;
            contentOpacity.setValue(1);
            cardOpacity.setValue(0);
            cardY.setValue(8);
            Animated.parallel([
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 240,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(cardY, {
                    toValue: 0,
                    duration: 240,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
            return;
        }

        if (finishedId.current === state.id) return;
        finishedId.current = state.id;
        contentOpacity.setValue(0);
        cardOpacity.setValue(1);
        cardY.setValue(0);
        Animated.sequence([
            Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.delay(1500),
            Animated.parallel([
                Animated.timing(cardOpacity, {
                    toValue: 0,
                    duration: 520,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(cardY, {
                    toValue: -8,
                    duration: 520,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [cardOpacity, cardY, contentOpacity, fractionAnim, state]);

    if (!state) return null;

    const isUploading = state.status === 'uploading';
    const isError = state.status === 'error';
    const title = isUploading
        ? state.title || 'Optimizing video…'
        : isError
          ? state.title || 'Post failed'
          : 'Your post is now live';
    const subtitle =
        isUploading &&
        state.message &&
        state.message !== title &&
        !percentFromMessage(state.message)
            ? state.message
            : isError
              ? state.message || 'Could not post. Please try again.'
              : null;
    const thumbSource = state.thumbUri ? { uri: state.thumbUri } : undefined;
    const ringOffset = RING_C * (1 - displayPct / 100);
    const glideX = indeterminate.interpolate({
        inputRange: [0, 1],
        outputRange: [-72, 180],
    });

    return (
        <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
            <Animated.View
                pointerEvents={isUploading ? 'auto' : 'none'}
                style={[
                    styles.card,
                    isError && styles.cardError,
                    {
                        opacity: cardOpacity,
                        transform: [{ translateY: cardY }],
                    },
                ]}
            >
                <Animated.View style={[styles.row, { opacity: contentOpacity }]}>
                    <View style={styles.thumbSlot}>
                        {thumbSource ? (
                            <Image source={thumbSource} style={styles.thumb} />
                        ) : (
                            <View
                                style={[
                                    styles.thumb,
                                    styles.thumbFallback,
                                    {
                                        backgroundColor:
                                            state.textThumbBackground || '#141018',
                                    },
                                ]}
                            >
                                <Text style={styles.thumbLetter} numberOfLines={1}>
                                    {state.textThumbLabel?.slice(0, 1) || ''}
                                </Text>
                            </View>
                        )}
                        {isUploading && showDeterminate ? (
                            <Svg width={RING} height={RING} style={styles.ring}>
                                <Circle
                                    cx={RING / 2}
                                    cy={RING / 2}
                                    r={RING_R}
                                    stroke="rgba(255,255,255,0.18)"
                                    strokeWidth={STROKE}
                                    fill="none"
                                />
                                <Circle
                                    cx={RING / 2}
                                    cy={RING / 2}
                                    r={RING_R}
                                    stroke="#FFFFFF"
                                    strokeWidth={STROKE}
                                    fill="none"
                                    strokeDasharray={`${RING_C} ${RING_C}`}
                                    strokeDashoffset={ringOffset}
                                    strokeLinecap="round"
                                    transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                                />
                            </Svg>
                        ) : (
                            <View style={[styles.statusBadge, isError && styles.statusBadgeError]}>
                                <Icon
                                    name={isError ? 'alert' : isUploading ? 'cloud-upload-outline' : 'checkmark'}
                                    size={11}
                                    color="#FFFFFF"
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.copy}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            {showDeterminate ? (
                                <Text style={styles.percent}>{displayPct}%</Text>
                            ) : null}
                        </View>
                        {subtitle ? (
                            <Text
                                style={[styles.subtitle, isError && styles.subtitleError]}
                                numberOfLines={1}
                            >
                                {subtitle}
                            </Text>
                        ) : null}
                        {isUploading ? (
                            <View
                                style={styles.track}
                                accessibilityRole="progressbar"
                                accessibilityValue={
                                    showDeterminate
                                        ? { min: 0, max: 100, now: displayPct }
                                        : undefined
                                }
                            >
                                {showDeterminate ? (
                                    <View style={[styles.fill, { width: `${displayPct}%` }]} />
                                ) : (
                                    <Animated.View
                                        style={[styles.glide, { transform: [{ translateX: glideX }] }]}
                                    />
                                )}
                            </View>
                        ) : null}
                    </View>

                    {showDeterminate ? (
                        <Pressable
                            onPress={() => {
                                cancelActiveVideoCompression();
                                cancelActiveFfmpeg();
                            }}
                            style={styles.cancel}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel video optimization"
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    ) : null}
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 20,
        alignItems: 'center',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        minHeight: 68,
        borderRadius: 18,
        paddingVertical: 10,
        paddingLeft: 10,
        paddingRight: 12,
        justifyContent: 'center',
        ...glassPanel,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    cardError: {
        borderColor: 'rgba(248, 113, 113, 0.45)',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbSlot: {
        width: RING,
        height: RING,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumb: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#141018',
    },
    thumbFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbLetter: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    ring: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    statusBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#0F766E',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#1A1524',
    },
    statusBadgeError: {
        backgroundColor: '#B91C1C',
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        color: '#F4F4F5',
        fontSize: 14,
        fontWeight: '600',
        marginRight: 8,
    },
    percent: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 2,
    },
    subtitleError: {
        color: '#FECACA',
    },
    track: {
        height: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginTop: 8,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    glide: {
        width: 72,
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    cancel: {
        marginLeft: 10,
        paddingVertical: 6,
        paddingHorizontal: 2,
    },
    cancelText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '600',
    },
});
