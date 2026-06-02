import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
    Modal,
    Animated,
    Easing,
    Platform,
    useWindowDimensions,
    type LayoutChangeEvent,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import GoldChromeAmbientCanvas from './GoldChromeAmbientCanvas.native';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_COLLAPSE_MS,
    STORIES24_EXPAND_MS,
    isStories24AddYoursHandle,
    normalizeStories24Handle,
    pickFirstStories24RailStory,
} from '../utils/stories24Rail';

const CARD_W = 112;
const CARD_H = 156;
const CARD_RADIUS = 16;

const GOLD_BORDER_GRADIENT = ['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3'] as const;
const GOLD_BORDER_LOCATIONS = [0, 0.24, 0.48, 0.72, 1] as const;
const GOLD_ICON_GRADIENT = [...GOLD_BORDER_GRADIENT] as string[];
const GOLD_ICON_LOCATIONS = [...GOLD_BORDER_LOCATIONS] as number[];

/** Web add-yours card chrome wash (exact rgba stops). */
const ADD_YOURS_WASH = [
    'rgba(246,226,122,0.22)',
    'rgba(212,175,55,0.2)',
    'rgba(244,244,244,0.15)',
    'rgba(191,197,204,0.2)',
    'rgba(255,232,163,0.22)',
] as const;
const ADD_YOURS_WASH_LOCATIONS = [0, 0.24, 0.48, 0.72, 1] as const;

/** Web story card tint: bg-gradient-to-tr from-teal/sky/fuchsia. */
const STORY_CARD_TINT = ['rgba(20,184,166,0.2)', 'rgba(56,189,248,0.2)', 'rgba(217,70,239,0.2)'] as const;

type CardRect = { x: number; y: number; width: number; height: number };

type ExpandingStory = {
    item: Stories24RailItem;
    railHandles: string[];
    rect: CardRect;
};

export type Stories24FeedRailHandle = {
    openFirstStory: () => boolean;
};

type Props = {
    items: Stories24RailItem[];
    onOpenStory: (item: Stories24RailItem, railHandles: string[]) => void;
    onAddYours: () => void;
    onScrollCardIntoView?: () => Promise<void>;
    collapsePayload?: Stories24RailReturnPayload | null;
    onCollapseHandled?: () => void;
};

function StoryPreviewVideo({ uri }: { uri: string }) {
    const videoRef = useRef<React.ElementRef<typeof Video>>(null);

    return (
        <Video
            ref={videoRef}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            muted
            repeat
            paused={false}
            onProgress={({ currentTime }) => {
                if (currentTime > 3) {
                    videoRef.current?.seek(0);
                }
            }}
        />
    );
}

function StoryCard({
    item,
    onPress,
    registerCardRef,
}: {
    item: Stories24RailItem;
    onPress: (rect: CardRect) => void;
    registerCardRef: (handle: string, node: View | null) => void;
}) {
    const cardRef = useRef<View>(null);
    const handleKey = normalizeStories24Handle(item.handle);
    const isAddYours = item.handle === STORIES24_ADD_YOURS_HANDLE;
    const displayHandle = item.handle.startsWith('@') ? item.handle : `@${item.handle.replace(/^@/, '')}`;

    const measureAndPress = () => {
        const node = cardRef.current;
        if (!node) return;
        node.measureInWindow((x, y, width, height) => {
            onPress({ x, y, width, height });
        });
    };

    const setCardRef = (node: View | null) => {
        (cardRef as React.MutableRefObject<View | null>).current = node;
        registerCardRef(handleKey, node);
    };

    if (isAddYours) {
        return (
            <View ref={setCardRef} collapsable={false}>
                <TouchableOpacity
                    style={[styles.card, styles.addYoursCard]}
                    onPress={measureAndPress}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={['#0e1a30', '#12243f', '#1a1530']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                        colors={[...ADD_YOURS_WASH]}
                        locations={[...ADD_YOURS_WASH_LOCATIONS]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.addYoursInner}>
                        <LinearGradient
                            colors={GOLD_ICON_GRADIENT}
                            locations={GOLD_ICON_LOCATIONS}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.addYoursIconCircle}
                        >
                            <FeedPlusIcon size={20} color="#111827" strokeWidth={2} />
                        </LinearGradient>
                        <Text style={styles.addYoursTitle}>Add yours</Text>
                        <Text style={styles.addYoursSub}>Post to Stories 24</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View ref={setCardRef} collapsable={false}>
            <TouchableOpacity style={styles.card} onPress={measureAndPress} activeOpacity={0.9}>
                <LinearGradient
                    colors={[...STORY_CARD_TINT]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
                {item.previewVideoUrl ? (
                    <StoryPreviewVideo uri={item.previewVideoUrl} />
                ) : item.thumb ? (
                    <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']}
                    locations={[0, 0.45, 1]}
                    style={styles.cardFooterGrad}
                />
                <View style={styles.cardFooter}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {item.subtitle || displayHandle}
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    );
}

function Stories24ExpandOverlay({
    expanding,
    onFinished,
}: {
    expanding: ExpandingStory;
    onFinished: () => void;
}) {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const { rect, item } = expanding;
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        progress.setValue(0);
        const anim = Animated.timing(progress, {
            toValue: 1,
            duration: STORIES24_EXPAND_MS,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: false,
        });
        anim.start(({ finished }) => {
            if (finished) onFinished();
        });
        return () => anim.stop();
    }, [expanding, onFinished, progress]);

    const top = progress.interpolate({ inputRange: [0, 1], outputRange: [rect.y, 0] });
    const left = progress.interpolate({ inputRange: [0, 1], outputRange: [rect.x, 0] });
    const width = progress.interpolate({ inputRange: [0, 1], outputRange: [rect.width, screenW] });
    const height = progress.interpolate({ inputRange: [0, 1], outputRange: [rect.height, screenH] });
    const borderRadius = progress.interpolate({ inputRange: [0, 1], outputRange: [CARD_RADIUS, 0] });

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.expandModalRoot} pointerEvents="none">
                <Animated.View
                    style={[{ top, left, width, height, borderRadius }, styles.expandCard]}
                >
                    <LinearGradient
                        colors={[...STORY_CARD_TINT]}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {item.thumb ? (
                        <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : null}
                    <View style={styles.expandDim} />
                </Animated.View>
            </View>
        </Modal>
    );
}

function Stories24CollapseOverlay({
    payload,
    targetRect,
    onFinished,
}: {
    payload: Stories24RailReturnPayload;
    targetRect: CardRect;
    onFinished: () => void;
}) {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        progress.setValue(0);
        const anim = Animated.timing(progress, {
            toValue: 1,
            duration: STORIES24_COLLAPSE_MS,
            easing: Easing.bezier(0.34, 1.28, 0.32, 1),
            useNativeDriver: false,
        });
        anim.start(({ finished }) => {
            if (finished) onFinished();
        });
        return () => anim.stop();
    }, [onFinished, progress]);

    const top = progress.interpolate({ inputRange: [0, 1], outputRange: [0, targetRect.y] });
    const left = progress.interpolate({ inputRange: [0, 1], outputRange: [0, targetRect.x] });
    const width = progress.interpolate({ inputRange: [0, 1], outputRange: [screenW, targetRect.width] });
    const height = progress.interpolate({ inputRange: [0, 1], outputRange: [screenH, targetRect.height] });
    const borderRadius = progress.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_RADIUS] });

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.collapseModalRoot} pointerEvents="none">
                <Animated.View
                    style={[{ top, left, width, height, borderRadius }, styles.expandCard]}
                >
                    <LinearGradient
                        colors={['rgba(100,116,139,0.25)', 'rgba(56,189,248,0.2)', 'rgba(99,102,241,0.25)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {payload.previewThumb ? (
                        <Image
                            source={{ uri: payload.previewThumb }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
                    ) : null}
                    <View style={styles.collapseVeil} />
                </Animated.View>
            </View>
        </Modal>
    );
}

const Stories24FeedRail = forwardRef<Stories24FeedRailHandle, Props>(function Stories24FeedRail(
    { items, onOpenStory, onAddYours, onScrollCardIntoView, collapsePayload, onCollapseHandled },
    ref,
) {
    const [expanding, setExpanding] = useState<ExpandingStory | null>(null);
    const [collapsing, setCollapsing] = useState<{
        payload: Stories24RailReturnPayload;
        rect: CardRect;
    } | null>(null);
    const [ambientSize, setAmbientSize] = useState({ width: 0, height: 0 });
    const onInnerLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setAmbientSize((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height },
            );
        }
    }, []);
    const expandingRef = useRef<ExpandingStory | null>(null);
    const cardRefs = useRef<Record<string, View | null>>({});
    expandingRef.current = expanding;

    const registerCardRef = React.useCallback((handle: string, node: View | null) => {
        cardRefs.current[handle] = node;
    }, []);

    useEffect(() => {
        if (!collapsePayload) return;

        const handleKey = normalizeStories24Handle(collapsePayload.handle);
        const hasCard = items.some((item) => normalizeStories24Handle(item.handle) === handleKey);
        if (!hasCard) {
            onCollapseHandled?.();
            return;
        }

        let cancelled = false;
        let frameId = 0;
        let measureAttempts = 0;
        const maxMeasureAttempts = 45;
        const startedAt = Date.now();

        const finishWithoutAnimation = async () => {
            if (cancelled) return;
            try {
                await onScrollCardIntoView?.();
            } catch {
                /* ignore */
            }
            if (!cancelled) onCollapseHandled?.();
        };

        // Fullscreen shrink is fragile on Android (measure loops + Fabric); scroll rail into view only.
        if (Platform.OS === 'android') {
            void finishWithoutAnimation();
            return () => {
                cancelled = true;
            };
        }

        const measureCard = () => {
            if (cancelled) return;
            measureAttempts += 1;
            if (measureAttempts > maxMeasureAttempts) {
                onCollapseHandled?.();
                return;
            }
            const node = cardRefs.current[handleKey];
            if (!node) {
                frameId = requestAnimationFrame(measureCard);
                return;
            }
            node.measureInWindow((x, y, width, height) => {
                if (cancelled) return;
                if (width < 8 || height < 8) {
                    frameId = requestAnimationFrame(measureCard);
                    return;
                }
                setCollapsing({ payload: collapsePayload, rect: { x, y, width, height } });
            });
        };

        const tryRun = async () => {
            if (cancelled) return;
            if (Date.now() - startedAt > 3200) {
                onCollapseHandled?.();
                return;
            }
            try {
                await onScrollCardIntoView?.();
            } catch {
                /* ignore */
            }
            if (cancelled) return;
            frameId = requestAnimationFrame(() => {
                frameId = requestAnimationFrame(measureCard);
            });
        };

        void tryRun();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
        };
    }, [collapsePayload, items, onCollapseHandled, onScrollCardIntoView]);

    const railHandles = useMemo(
        () => items.map((i) => i.handle).filter((h) => h && h !== STORIES24_ADD_YOURS_HANDLE),
        [items],
    );

    const openFirstStoryFromRail = React.useCallback(() => {
        const first = pickFirstStories24RailStory(items);
        if (!first || isStories24AddYoursHandle(first.handle)) {
            return false;
        }
        const handleKey = normalizeStories24Handle(first.handle);
        const node = cardRefs.current[handleKey];
        const startExpand = (rect: CardRect) => {
            if (expandingRef.current) return;
            setExpanding({ item: first, railHandles, rect });
        };
        if (!node) {
            onOpenStory(first, railHandles);
            return true;
        }
        node.measureInWindow((x, y, width, height) => {
            if (width < 8 || height < 8) {
                onOpenStory(first, railHandles);
                return;
            }
            startExpand({ x, y, width, height });
        });
        return true;
    }, [items, onOpenStory, railHandles]);

    useImperativeHandle(ref, () => ({ openFirstStory: openFirstStoryFromRail }), [openFirstStoryFromRail]);

    if (items.length === 0) return null;

    const handleStoryCardPress = (item: Stories24RailItem, rect: CardRect) => {
        if (expandingRef.current) return;
        setExpanding({ item, railHandles, rect });
    };

    const finishExpand = () => {
        const current = expandingRef.current;
        if (!current) return;
        setExpanding(null);
        onOpenStory(current.item, current.railHandles);
    };

    return (
        <View collapsable={false}>
            <LinearGradient
                colors={[...GOLD_BORDER_GRADIENT]}
                locations={[...GOLD_BORDER_LOCATIONS]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.outerBorder}
            >
                <View
                    style={styles.inner}
                    onLayout={onInnerLayout}
                    collapsable={false}
                    {...(Platform.OS === 'android' ? { needsOffscreenAlphaCompositing: true } : {})}
                >
                    {ambientSize.width > 0 && ambientSize.height > 0 && Platform.OS !== 'android' ? (
                        <GoldChromeAmbientCanvas
                            width={ambientSize.width}
                            height={ambientSize.height}
                        />
                    ) : null}
                    <View style={styles.contentLayer}>
                        <View style={styles.headerRow}>
                            <View style={styles.titleRow}>
                                <Stories24MapPinIcon size={16} />
                                <Text style={styles.railTitle}>Stories 24</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.addYoursBtn}
                                onPress={onAddYours}
                                activeOpacity={0.85}
                            >
                                <FeedPlusIcon size={12} color="#111827" strokeWidth={2.5} />
                                <Text style={styles.addYoursBtnText}>Add yours</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {items.map((item) => (
                                <StoryCard
                                    key={
                                        item.handle === STORIES24_ADD_YOURS_HANDLE
                                            ? 'add-yours'
                                            : item.handle
                                    }
                                    item={item}
                                    registerCardRef={registerCardRef}
                                    onPress={(rect) => {
                                        if (item.handle === STORIES24_ADD_YOURS_HANDLE) {
                                            onAddYours();
                                        } else {
                                            handleStoryCardPress(item, rect);
                                        }
                                    }}
                                />
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </LinearGradient>
            {expanding ? (
                <Stories24ExpandOverlay expanding={expanding} onFinished={finishExpand} />
            ) : null}
            {collapsing ? (
                <Stories24CollapseOverlay
                    payload={collapsing.payload}
                    targetRect={collapsing.rect}
                    onFinished={() => {
                        setCollapsing(null);
                        onCollapseHandled?.();
                    }}
                />
            ) : null}
        </View>
    );
});

export default Stories24FeedRail;

const styles = StyleSheet.create({
    outerBorder: {
        marginHorizontal: 12,
        marginVertical: 12,
        borderRadius: 16,
        padding: 1.5,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 10,
    },
    inner: {
        position: 'relative',
        borderRadius: 16,
        backgroundColor: '#0a1323',
        padding: 12,
        overflow: 'hidden',
    },
    contentLayer: {
        position: 'relative',
        zIndex: 2,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 6,
    },
    railTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    addYoursBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    addYoursBtnText: {
        color: '#111827',
        fontSize: 11,
        fontWeight: '600',
    },
    scrollContent: {
        columnGap: 8,
        paddingBottom: 4,
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#101b2f',
    },
    addYoursCard: {
        borderColor: 'rgba(255,255,255,0.8)',
    },
    addYoursInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        rowGap: 8,
    },
    addYoursIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    addYoursTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    addYoursSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
    },
    cardFooterGrad: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 72,
    },
    cardFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 8,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
    },
    cardSubtitle: {
        color: '#7A8AF0',
        fontSize: 10,
        marginTop: 4,
    },
    expandModalRoot: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    collapseModalRoot: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    collapseVeil: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    expandCard: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#101b2f',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.45,
        shadowRadius: 30,
        elevation: 16,
    },
    expandDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
});
