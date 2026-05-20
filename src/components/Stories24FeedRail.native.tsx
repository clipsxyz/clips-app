import React, { useEffect, useRef, useState } from 'react';
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
    useWindowDimensions,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_COLLAPSE_MS,
    STORIES24_EXPAND_MS,
    normalizeStories24Handle,
} from '../utils/stories24Rail';

const CARD_W = 112;
const CARD_H = 156;
const CARD_RADIUS = 16;

type CardRect = { x: number; y: number; width: number; height: number };

type ExpandingStory = {
    item: Stories24RailItem;
    railHandles: string[];
    rect: CardRect;
};

type Props = {
    items: Stories24RailItem[];
    onOpenStory: (item: Stories24RailItem, railHandles: string[]) => void;
    onAddYours: () => void;
    /** Set by Feed when returning from Stories (rail shrink). */
    collapsePayload?: Stories24RailReturnPayload | null;
    onCollapseHandled?: () => void;
};

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
                        colors={['rgba(246,226,122,0.22)', 'rgba(212,175,55,0.2)', 'rgba(255,232,163,0.22)']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.addYoursInner}>
                        <LinearGradient
                            colors={['#f6e27a', '#d4af37', '#ffe8a3']}
                            style={styles.addYoursIconCircle}
                        >
                            <Icon name="add" size={22} color="#111827" />
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
                    colors={['rgba(20,184,166,0.2)', 'rgba(56,189,248,0.2)', 'rgba(217,70,239,0.2)']}
                    style={StyleSheet.absoluteFill}
                />
                {item.previewVideoUrl ? (
                    <Video
                        source={{ uri: item.previewVideoUrl }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        muted
                        repeat
                        paused={false}
                    />
                ) : item.thumb ? (
                    <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
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

    const top = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [rect.y, 0],
    });
    const left = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [rect.x, 0],
    });
    const width = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [rect.width, screenW],
    });
    const height = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [rect.height, screenH],
    });
    const borderRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [CARD_RADIUS, 0],
    });

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.expandModalRoot} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.expandCard,
                        {
                            top,
                            left,
                            width,
                            height,
                            borderRadius,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(20,184,166,0.2)', 'rgba(56,189,248,0.2)', 'rgba(217,70,239,0.2)']}
                        style={StyleSheet.absoluteFill}
                    />
                    {item.thumb ? (
                        <Image
                            source={{ uri: item.thumb }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
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

    const top = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, targetRect.y],
    });
    const left = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, targetRect.x],
    });
    const width = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [screenW, targetRect.width],
    });
    const height = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [screenH, targetRect.height],
    });
    const borderRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, CARD_RADIUS],
    });

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.collapseModalRoot} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.expandCard,
                        {
                            top,
                            left,
                            width,
                            height,
                            borderRadius,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(100,116,139,0.25)', 'rgba(56,189,248,0.2)', 'rgba(99,102,241,0.25)']}
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

export default function Stories24FeedRail({
    items,
    onOpenStory,
    onAddYours,
    collapsePayload,
    onCollapseHandled,
}: Props) {
    const [expanding, setExpanding] = useState<ExpandingStory | null>(null);
    const [collapsing, setCollapsing] = useState<{
        payload: Stories24RailReturnPayload;
        rect: CardRect;
    } | null>(null);
    const expandingRef = useRef<ExpandingStory | null>(null);
    const cardRefs = useRef<Record<string, View | null>>({});
    expandingRef.current = expanding;

    const registerCardRef = React.useCallback((handle: string, node: View | null) => {
        cardRefs.current[handle] = node;
    }, []);

    useEffect(() => {
        if (!collapsePayload) return;

        let cancelled = false;
        let frameId = 0;
        const startedAt = Date.now();
        const handleKey = normalizeStories24Handle(collapsePayload.handle);

        const tryRun = () => {
            if (cancelled) return;
            if (Date.now() - startedAt > 3200) {
                onCollapseHandled?.();
                return;
            }

            const node = cardRefs.current[handleKey];
            if (!node) {
                frameId = requestAnimationFrame(tryRun);
                return;
            }

            node.measureInWindow((x, y, width, height) => {
                if (cancelled) return;
                if (width < 8 || height < 8) {
                    frameId = requestAnimationFrame(tryRun);
                    return;
                }
                setCollapsing({ payload: collapsePayload, rect: { x, y, width, height } });
            });
        };

        tryRun();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
        };
    }, [collapsePayload, onCollapseHandled]);

    if (items.length === 0) return null;

    const railHandles = items
        .map((i) => i.handle)
        .filter((h) => h && h !== STORIES24_ADD_YOURS_HANDLE);

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
        <>
            <LinearGradient
                colors={['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.outerBorder}
            >
                <View style={styles.inner}>
                    <DiscoverAmbientCanvas variant="goldChrome" />
                    <View style={styles.headerRow}>
                        <View style={styles.titleRow}>
                            <Icon name="location" size={16} color="#d4af37" />
                            <Text style={styles.railTitle}>Stories 24</Text>
                        </View>
                        <TouchableOpacity style={styles.addYoursBtn} onPress={onAddYours}>
                            <Icon name="add" size={12} color="#111827" />
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
                                key={item.handle === STORIES24_ADD_YOURS_HANDLE ? 'add-yours' : item.handle}
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
        </>
    );
}

const styles = StyleSheet.create({
    outerBorder: {
        marginHorizontal: 10,
        marginVertical: 10,
        borderRadius: 16,
        padding: 1.5,
    },
    inner: {
        borderRadius: 14,
        backgroundColor: '#0a1323',
        padding: 12,
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        zIndex: 2,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    railTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    addYoursBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    addYoursBtnText: {
        color: '#111827',
        fontSize: 11,
        fontWeight: '700',
    },
    scrollContent: {
        gap: 8,
        paddingBottom: 2,
        zIndex: 2,
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: '#101b2f',
    },
    addYoursCard: {
        borderColor: 'rgba(255,255,255,0.35)',
    },
    addYoursInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addYoursIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addYoursTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
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
        fontWeight: '700',
    },
    cardSubtitle: {
        color: '#7A8AF0',
        fontSize: 10,
        marginTop: 2,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
        elevation: 16,
    },
    expandDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
});
