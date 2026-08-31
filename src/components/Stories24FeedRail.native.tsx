import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
    Modal,
    Platform,
    AppState,
    useWindowDimensions,
    type LayoutChangeEvent,
} from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import type { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import GoldChromeAmbientCanvas from './GoldChromeAmbientCanvas.native';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import { getFeedScrollBusy, subscribeFeedScrollBusy } from '../utils/feedScrollBusyNative';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_COLLAPSE_MS,
    STORIES24_EXPAND_MS,
    isStories24AddYoursHandle,
    normalizeStories24Handle,
    pickFirstStories24RailStory,
} from '../utils/stories24Rail';
import { storyVideoSource } from '../utils/storyMediaNative';
import StorySafeVideo from './stories/StorySafeVideo.native';
const CARD_W = 112;
const CARD_H = 156;
const CARD_RADIUS = 16;
/** Idle / missing poster — never the old BBB rainbow test card. */
const PREVIEW_POSTER_FALLBACK = '#121212';

/** Threads/Apple-TV shared-element morph (card ↔ fullscreen). */
const EXPAND_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const COLLAPSE_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const COLLAPSE_HOLD_MS = 32;

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

function hasMorphStill(uri?: string | null): boolean {
    return typeof uri === 'string' && uri.trim().length > 0 && !uri.startsWith('#');
}

/** MP4s skip card morph — open goes straight to Stories splash; close uses scale+fade. */
function shouldScaleFadeCloseForVideo(thumb?: string | null, previewVideoUrl?: string | null): boolean {
    return !!previewVideoUrl && !hasMorphStill(thumb);
}

const VIDEO_SCALE_FADE_CLOSE_MS = 320;

export type Stories24FeedRailHandle = {
    openFirstStory: () => boolean;
};

type Props = {
    items: Stories24RailItem[];
    /** When true (feed scrolling), show posters instead of playing preview MP4s. */
    previewVideosPaused?: boolean;
    onOpenStory: (item: Stories24RailItem, railHandles: string[]) => void;
    onAddYours: () => void;
    onScrollCardIntoView?: () => Promise<void>;
    collapsePayload?: Stories24RailReturnPayload | null;
    onCollapseHandled?: () => void;
};

function StoryPreviewVideo({
    uri,
    posterUri,
    paused,
}: {
    uri: string;
    posterUri?: string;
    paused: boolean;
}) {
    const videoRef = useRef<VideoRef>(null);
    // Local scroll-busy only — do not setState on the FlatList header (jumps scroll).
    const [feedScrolling, setFeedScrolling] = useState(getFeedScrollBusy());
    useEffect(() => subscribeFeedScrollBusy(setFeedScrolling), []);
    const effectivelyPaused = paused || feedScrolling;

    const source = storyVideoSource(uri) || { uri };
    // Prefer the story/post still — never the bundled BBB rainbow test card.
    const posterSource =
        posterUri && !posterUri.startsWith('#') ? { uri: posterUri } : undefined;

    // Android TextureView steals touches — keep preview non-interactive so the card press works.
    // When paused without a real still, keep a paused video frame (not profile avatar / empty).
    if (effectivelyPaused && posterSource) {
        return (
            <Image
                source={posterSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                pointerEvents="none"
            />
        );
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <StorySafeVideo
                videoRef={videoRef}
                source={source}
                posterSource={posterSource}
                style={StyleSheet.absoluteFill}
                muted
                repeat
                paused={effectivelyPaused}
                onProgress={({ currentTime }) => {
                    if (currentTime > 3) {
                        videoRef.current?.seek(0);
                    }
                }}
            />
        </View>
    );
}

function StoryCard({
    item,
    onPress,
    registerCardRef,
    playPreviewVideo,
    previewVideosPaused,
    /** Hide while the shared-element clone is flying (avoids double-image ghost). */
    morphHidden = false,
}: {
    item: Stories24RailItem;
    onPress: (rect: CardRect) => void;
    registerCardRef: (handle: string, node: View | null) => void;
    playPreviewVideo: boolean;
    previewVideosPaused: boolean;
    morphHidden?: boolean;
}) {
    const cardRef = useRef<View>(null);
    const handleKey = normalizeStories24Handle(item.handle);
    const isAddYours = item.handle === STORIES24_ADD_YOURS_HANDLE;
    const displayHandle = item.handle.startsWith('@') ? item.handle : `@${item.handle.replace(/^@/, '')}`;

    const measureAndPress = () => {
        const fallback: CardRect = { x: 0, y: 0, width: CARD_W, height: CARD_H };
        const node = cardRef.current;
        if (!node) {
            onPress(fallback);
            return;
        }
        let settled = false;
        const settle = (rect: CardRect) => {
            if (settled) return;
            settled = true;
            onPress(rect);
        };
        node.measureInWindow((x, y, width, height) => {
            if (width < 8 || height < 8) {
                settle(fallback);
                return;
            }
            settle({ x, y, width, height });
        });
        // Android can drop measureInWindow after rail remount (e.g. post share refresh).
        setTimeout(() => settle(fallback), 64);
    };

    const setCardRef = (node: View | null) => {
        (cardRef as React.MutableRefObject<View | null>).current = node;
        registerCardRef(handleKey, node);
    };

    if (isAddYours) {
        return (
            <View ref={setCardRef} collapsable={false} style={morphHidden ? styles.cardMorphHidden : undefined}>
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
        <View ref={setCardRef} collapsable={false} style={morphHidden ? styles.cardMorphHidden : undefined}>
            <TouchableOpacity style={styles.card} onPress={measureAndPress} activeOpacity={0.9}>
                <LinearGradient
                    colors={[...STORY_CARD_TINT]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
                {item.previewVideoUrl ? (
                    <StoryPreviewVideo
                        uri={item.previewVideoUrl}
                        posterUri={item.thumb}
                        paused={previewVideosPaused || !playPreviewVideo}
                    />
                ) : item.thumb ? (
                    <Image
                        source={{ uri: item.thumb }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        pointerEvents="none"
                    />
                ) : (
                    <View
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFill, { backgroundColor: PREVIEW_POSTER_FALLBACK }]}
                    />
                )}
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
    onMorphStarted,
}: {
    expanding: ExpandingStory;
    onFinished: () => void;
    onMorphStarted: () => void;
}) {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const { rect, item } = expanding;
    const progress = useSharedValue(0);
    const oX = useSharedValue(rect.x);
    const oY = useSharedValue(rect.y);
    const oW = useSharedValue(rect.width);
    const oH = useSharedValue(rect.height);
    const screenWSv = useSharedValue(screenW);
    const screenHSv = useSharedValue(screenH);
    const finishedRef = useRef(false);

    const finish = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onFinished();
    }, [onFinished]);

    useEffect(() => {
        finishedRef.current = false;
        oX.value = rect.x;
        oY.value = rect.y;
        oW.value = Math.max(1, rect.width);
        oH.value = Math.max(1, rect.height);
        screenWSv.value = screenW;
        screenHSv.value = screenH;
        cancelAnimation(progress);
        progress.value = 0;
        onMorphStarted();
        progress.value = withTiming(
            1,
            { duration: STORIES24_EXPAND_MS, easing: EXPAND_EASE },
            (ok) => {
                runOnJS(finish)();
                void ok;
            },
        );
        const fallback = setTimeout(finish, STORIES24_EXPAND_MS + 100);
        return () => {
            clearTimeout(fallback);
            cancelAnimation(progress);
            finish();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanding]);

    const shellStyle = useAnimatedStyle(() => {
        const p = progress.value;
        return {
            position: 'absolute' as const,
            left: interpolate(p, [0, 1], [oX.value, 0]),
            top: interpolate(p, [0, 1], [oY.value, 0]),
            width: interpolate(p, [0, 1], [oW.value, screenWSv.value]),
            height: interpolate(p, [0, 1], [oH.value, screenHSv.value]),
            borderRadius: interpolate(p, [0, 1], [CARD_RADIUS, 0]),
            overflow: 'hidden' as const,
            shadowOpacity: interpolate(p, [0, 0.4, 1], [0.25, 0.55, 0]),
            shadowRadius: interpolate(p, [0, 0.4, 1], [12, 36, 0]),
            elevation: interpolate(p, [0, 0.45, 1], [8, 28, 0]),
        };
    });

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.55, 1]),
    }));

    const veilStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.65, 1], [0.22, 0.1, 0]),
    }));

    const stillUri = hasMorphStill(item.thumb) ? item.thumb : undefined;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.expandModalRoot} pointerEvents="none">
                <Animated.View style={[styles.expandBackdrop, backdropStyle]} />
                <Animated.View style={[styles.expandCard, shellStyle]}>
                    <LinearGradient
                        colors={[...STORY_CARD_TINT]}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {stillUri ? (
                        <Image source={{ uri: stillUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: PREVIEW_POSTER_FALLBACK }]} />
                    )}
                    <Animated.View style={[styles.expandDim, veilStyle]} />
                </Animated.View>
            </View>
        </Modal>
    );
}

function Stories24CollapseOverlay({
    payload,
    targetRect,
    onFinished,
    onMorphStarted,
}: {
    payload: Stories24RailReturnPayload;
    targetRect: CardRect;
    onFinished: () => void;
    onMorphStarted: () => void;
}) {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const fadeMode = shouldScaleFadeCloseForVideo(payload.previewThumb, payload.previewVideoUrl);
    const fadeModeSv = useSharedValue(fadeMode ? 1 : 0);
    const progress = useSharedValue(0);
    const tX = useSharedValue(targetRect.x);
    const tY = useSharedValue(targetRect.y);
    const tW = useSharedValue(Math.max(1, targetRect.width));
    const tH = useSharedValue(Math.max(1, targetRect.height));
    const screenWSv = useSharedValue(screenW);
    const screenHSv = useSharedValue(screenH);
    const finishedRef = useRef(false);
    const onFinishedRef = useRef(onFinished);
    onFinishedRef.current = onFinished;
    const duration = fadeMode ? VIDEO_SCALE_FADE_CLOSE_MS : STORIES24_COLLAPSE_MS;

    const finish = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onFinishedRef.current();
    }, []);

    useEffect(() => {
        finishedRef.current = false;
        fadeModeSv.value = fadeMode ? 1 : 0;
        cancelAnimation(progress);
        progress.value = 0;
        onMorphStarted();

        let shrinkTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            shrinkTimer = null;
            progress.value = withTiming(
                1,
                { duration, easing: COLLAPSE_EASE },
                (ok) => {
                    if (ok) runOnJS(finish)();
                },
            );
        }, COLLAPSE_HOLD_MS);

        const fallback = setTimeout(finish, COLLAPSE_HOLD_MS + duration + 120);
        return () => {
            if (shrinkTimer) clearTimeout(shrinkTimer);
            clearTimeout(fallback);
            cancelAnimation(progress);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const shellStyle = useAnimatedStyle(() => {
        const p = progress.value;
        if (fadeModeSv.value === 1) {
            // Scale + fade toward center (Instagram-style dismiss) — no stretch into the rail tile.
            const scale = interpolate(p, [0, 1], [1, 0.86]);
            return {
                position: 'absolute' as const,
                left: 0,
                top: 0,
                width: screenWSv.value,
                height: screenHSv.value,
                borderRadius: interpolate(p, [0, 1], [0, 28]),
                overflow: 'hidden' as const,
                opacity: interpolate(p, [0, 0.45, 1], [1, 0.75, 0]),
                transform: [{ scale }],
            };
        }
        return {
            position: 'absolute' as const,
            left: interpolate(p, [0, 1], [0, tX.value]),
            top: interpolate(p, [0, 1], [0, tY.value]),
            width: interpolate(p, [0, 1], [screenWSv.value, tW.value]),
            height: interpolate(p, [0, 1], [screenHSv.value, tH.value]),
            borderRadius: interpolate(p, [0, 1], [0, CARD_RADIUS]),
            overflow: 'hidden' as const,
            shadowOpacity: interpolate(p, [0, 0.55, 1], [0, 0.5, 0.2]),
            shadowRadius: interpolate(p, [0, 0.55, 1], [0, 32, 10]),
            elevation: interpolate(p, [0, 0.5, 1], [0, 26, 6]),
        };
    });

    const backdropStyle = useAnimatedStyle(() => ({
        opacity:
            fadeModeSv.value === 1
                ? interpolate(progress.value, [0, 0.35, 1], [1, 0.55, 0])
                : interpolate(progress.value, [0, 0.72, 1], [1, 0.88, 0]),
    }));

    const veilStyle = useAnimatedStyle(() => ({
        opacity:
            fadeModeSv.value === 1
                ? 0
                : interpolate(progress.value, [0, 0.55, 1], [0, 0.08, 0.16]),
    }));

    const stillUri = hasMorphStill(payload.previewThumb) ? payload.previewThumb : undefined;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.collapseModalRoot} pointerEvents="none">
                <Animated.View style={[styles.expandBackdrop, backdropStyle]} />
                <Animated.View style={[styles.expandCard, shellStyle]}>
                    {fadeMode ? (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
                    ) : (
                        <>
                            <LinearGradient
                                colors={[...STORY_CARD_TINT]}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            {stillUri ? (
                                <Image
                                    source={{ uri: stillUri }}
                                    style={StyleSheet.absoluteFill}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View
                                    style={[
                                        StyleSheet.absoluteFill,
                                        { backgroundColor: PREVIEW_POSTER_FALLBACK },
                                    ]}
                                />
                            )}
                            <Animated.View style={[styles.collapseVeil, veilStyle]} />
                        </>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const Stories24FeedRail = forwardRef<Stories24FeedRailHandle, Props>(function Stories24FeedRail(
    {
        items,
        previewVideosPaused = false,
        onOpenStory,
        onAddYours,
        onScrollCardIntoView,
        collapsePayload,
        onCollapseHandled,
    },
    ref,
) {
    const [expanding, setExpanding] = useState<ExpandingStory | null>(null);
    const [expandHideSource, setExpandHideSource] = useState(false);
    const [collapseHideSource, setCollapseHideSource] = useState(false);
    const [railScrolling, setRailScrolling] = useState(false);
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');
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
    /** Last card rect used to open a story — Android collapse fallback when measure fails. */
    const lastOpenRectByHandleRef = useRef<Record<string, CardRect>>({});

    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            setAppActive(next === 'active');
        });
        return () => sub.remove();
    }, []);
    /** Prevents collapse restart when feed/items refresh mid-animation. */
    const collapseSessionRef = useRef<string | null>(null);
    const onCollapseHandledRef = useRef(onCollapseHandled);
    const onScrollCardIntoViewRef = useRef(onScrollCardIntoView);
    onCollapseHandledRef.current = onCollapseHandled;
    onScrollCardIntoViewRef.current = onScrollCardIntoView;
    expandingRef.current = expanding;

    const registerCardRef = React.useCallback((handle: string, node: View | null) => {
        cardRefs.current[handle] = node;
    }, []);

    useEffect(() => {
        if (!collapsePayload) {
            collapseSessionRef.current = null;
            return;
        }

        const handleKey = normalizeStories24Handle(collapsePayload.handle);
        const sessionKey = `${handleKey}:${collapsePayload.previewThumb || ''}:${collapsePayload.previewVideoUrl || ''}`;
        if (collapseSessionRef.current === sessionKey) {
            return;
        }

        const hasCard = items.some((item) => normalizeStories24Handle(item.handle) === handleKey);
        if (!hasCard) {
            onCollapseHandledRef.current?.();
            return;
        }

        // MP4 closes animate on StoriesScreen itself — don't run a second feed morph.
        if (shouldScaleFadeCloseForVideo(collapsePayload.previewThumb, collapsePayload.previewVideoUrl)) {
            onCollapseHandledRef.current?.();
            return;
        }

        collapseSessionRef.current = sessionKey;

        let cancelled = false;
        let frameId = 0;
        let measureAttempts = 0;
        const maxMeasureAttempts = 18;

        const startCollapse = (rect: CardRect) => {
            if (cancelled) return;
            lastOpenRectByHandleRef.current[handleKey] = rect;
            // Fade close keeps the card visible under the dim; still morph hides the source tile.
            const fadeClose = shouldScaleFadeCloseForVideo(
                collapsePayload.previewThumb,
                collapsePayload.previewVideoUrl,
            );
            setCollapseHideSource(!fadeClose);
            setCollapsing({ payload: collapsePayload, rect });
        };

        const finishWithoutAnimation = () => {
            if (cancelled) return;
            onCollapseHandledRef.current?.();
        };

        const measureCard = () => {
            if (cancelled) return;
            measureAttempts += 1;
            if (measureAttempts > maxMeasureAttempts) {
                // Last resort only — open-time rect may be wrong after feed scroll restore.
                const cached = lastOpenRectByHandleRef.current[handleKey];
                if (cached && cached.width > 8 && cached.height > 8) {
                    startCollapse(cached);
                    return;
                }
                finishWithoutAnimation();
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
                startCollapse({ x, y, width, height });
            });
        };

        // Always scroll the rail into view, then remeasure — never shrink to a stale open rect.
        void onScrollCardIntoViewRef.current?.()
            .catch(() => {})
            .finally(() => {
                if (cancelled) return;
                frameId = requestAnimationFrame(() => {
                    frameId = requestAnimationFrame(measureCard);
                });
            });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
        };
        // Only re-enter when a new collapse payload arrives — not when items/callbacks churn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collapsePayload]);

    const railHandles = useMemo(
        () => items.map((i) => i.handle).filter((h) => h && h !== STORIES24_ADD_YOURS_HANDLE),
        [items],
    );

    const firstStoryPreviewHandle = useMemo(
        () => items.find((i) => i.handle !== STORIES24_ADD_YOURS_HANDLE)?.handle ?? null,
        [items],
    );

    const previewsPaused = previewVideosPaused || railScrolling || !appActive;

    const openFirstStoryFromRail = React.useCallback(() => {
        const first = pickFirstStories24RailStory(items);
        if (!first || isStories24AddYoursHandle(first.handle)) {
            return false;
        }
        const handleKey = normalizeStories24Handle(first.handle);
        const node = cardRefs.current[handleKey];
        const startExpand = (rect: CardRect) => {
            if (expandingRef.current) {
                onOpenStory(first, railHandles);
                setExpanding(null);
                setExpandHideSource(false);
                return;
            }
            // MP4 → straight to Stories splash (no card→fullscreen video morph).
            if (first.previewVideoUrl) {
                lastOpenRectByHandleRef.current[handleKey] = rect;
                onOpenStory(first, railHandles);
                return;
            }
            lastOpenRectByHandleRef.current[handleKey] = rect;
            setExpandHideSource(false);
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
        const handleKey = normalizeStories24Handle(item.handle);
        lastOpenRectByHandleRef.current[handleKey] = rect;
        // If a morph is already in flight (or stuck), open immediately instead of eating taps.
        if (expandingRef.current) {
            onOpenStory(item, railHandles);
            setExpanding(null);
            setExpandHideSource(false);
            return;
        }
        // MP4 → Stories splash only (skip expanding video before the loading hold).
        if (item.previewVideoUrl) {
            onOpenStory(item, railHandles);
            return;
        }
        setExpandHideSource(false);
        setExpanding({ item, railHandles, rect });
    };

    const finishExpand = () => {
        const current = expandingRef.current;
        if (!current) return;
        // Open Stories under the morph, then drop the overlay after paint (avoids feed flash).
        onOpenStory(current.item, current.railHandles);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setExpanding((prev) => (prev === current || prev?.item.handle === current.item.handle ? null : prev));
                setExpandHideSource(false);
            });
        });
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
                    {ambientSize.width > 0 && ambientSize.height > 0 ? (
                        Platform.OS === 'android' ? (
                            <View
                                style={[StyleSheet.absoluteFill, styles.androidAmbientFill]}
                                pointerEvents="none"
                            />
                        ) : (
                            <GoldChromeAmbientCanvas
                                width={ambientSize.width}
                                height={ambientSize.height}
                            />
                        )
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
                            onScrollBeginDrag={() => setRailScrolling(true)}
                            onScrollEndDrag={() => setRailScrolling(false)}
                            onMomentumScrollEnd={() => setRailScrolling(false)}
                        >
                            {items.map((item) => {
                                const handleKey = normalizeStories24Handle(item.handle);
                                // Keep the source card visible until the morph clone has a paintable frame.
                                const morphHidden =
                                    (!!expanding &&
                                        expandHideSource &&
                                        normalizeStories24Handle(expanding.item.handle) ===
                                            handleKey) ||
                                    (!!collapsing &&
                                        collapseHideSource &&
                                        normalizeStories24Handle(collapsing.payload.handle) ===
                                            handleKey);
                                return (
                                <StoryCard
                                    key={
                                        item.handle === STORIES24_ADD_YOURS_HANDLE
                                            ? 'add-yours'
                                            : item.handle
                                    }
                                    item={item}
                                    registerCardRef={registerCardRef}
                                    morphHidden={morphHidden}
                                    playPreviewVideo={
                                        !!item.previewVideoUrl &&
                                        item.handle === firstStoryPreviewHandle
                                    }
                                    previewVideosPaused={previewsPaused || morphHidden}
                                    onPress={(rect) => {
                                        if (item.handle === STORIES24_ADD_YOURS_HANDLE) {
                                            onAddYours();
                                        } else {
                                            handleStoryCardPress(item, rect);
                                        }
                                    }}
                                />
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </LinearGradient>
            {expanding ? (
                <Stories24ExpandOverlay
                    key={`expand-${normalizeStories24Handle(expanding.item.handle)}`}
                    expanding={expanding}
                    onMorphStarted={() => setExpandHideSource(true)}
                    onFinished={finishExpand}
                />
            ) : null}
            {collapsing ? (
                <Stories24CollapseOverlay
                    key={`collapse-${normalizeStories24Handle(collapsing.payload.handle)}-${collapsing.payload.previewThumb || collapsing.payload.previewVideoUrl || 'x'}`}
                    payload={collapsing.payload}
                    targetRect={collapsing.rect}
                    onMorphStarted={() => setCollapseHideSource(true)}
                    onFinished={() => {
                        setCollapsing(null);
                        setCollapseHideSource(false);
                        collapseSessionRef.current = null;
                        onCollapseHandledRef.current?.();
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
    androidAmbientFill: {
        backgroundColor: '#0a1323',
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
        backgroundColor: 'transparent',
    },
    expandBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
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
    cardMorphHidden: {
        opacity: 0,
    },
});
