import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Modal,
    AppState,
    useWindowDimensions,
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
import CachedImage from './CachedImage.native';
import LinearGradient from 'react-native-linear-gradient';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import Avatar from './Avatar.native';
import { getAvatarForHandle, setAvatarForHandle } from '../api/users';
import { useAuth } from '../context/Auth';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_COLLAPSE_MS,
    STORIES24_EXPAND_MS,
    isStories24AddYoursHandle,
    normalizeStories24Handle,
    pickFirstStories24RailStory,
    rankStories24RailItems,
} from '../utils/stories24Rail';
import {
    STORY_GRADIENT_RING_COLORS,
    STORY_GRADIENT_RING_END,
    STORY_GRADIENT_RING_START,
    STORY_RING_GAP,
    STORY_RING_WIDTH,
} from '../utils/storyRingNative';
const CARD_W = 175;
const CARD_H = 102;
const CARD_RADIUS = 10;
/** Outer story-card avatar slot; stroke + gap match the newsfeed header. */
const CARD_AVATAR_RING = 58;
const CARD_AVATAR_PHOTO = CARD_AVATAR_RING - (STORY_RING_WIDTH + STORY_RING_GAP) * 2;
/** Idle / missing poster — never the old BBB rainbow test card. */
const PREVIEW_POSTER_FALLBACK = '#121212';

/** Threads/Apple-TV shared-element morph (card ↔ fullscreen). */
const EXPAND_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const COLLAPSE_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const COLLAPSE_HOLD_MS = 32;

/** Champions League story card canvas — pure black → bright purple. */
const STORY_CARD_TINT = ['#000000', '#23104F'] as const;

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

function usableRailStill(uri?: string): string | undefined {
    const raw = (uri || '').trim();
    if (!raw || raw.startsWith('#')) return undefined;
    if (/^(file:|content:|blob:|ph:)/i.test(raw)) return undefined;
    if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(raw)) return undefined;
    return resolvePublicMediaUrl(raw) || raw;
}

function StoryPreviewVideo({
    posterUri,
}: {
    uri: string;
    posterUri?: string;
    paused: boolean;
}) {
    // Still-only rail thumbs. Android TextureView ignores overflow clipping and bleeds into
    // the feed; motion plays in the fullscreen story viewer instead.
    const poster = usableRailStill(posterUri);
    const posterSource = poster ? { uri: poster } : undefined;

    if (posterSource) {
        return (
            <CachedImage
                source={posterSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                pointerEvents="none"
            />
        );
    }

    return (
        <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: PREVIEW_POSTER_FALLBACK }]}
        />
    );
}

function StoryCard({
    item,
    index,
    onPress,
    registerCardRef,
    playPreviewVideo,
    previewVideosPaused,
    /** Hide while the shared-element clone is flying (avoids double-image ghost). */
    morphHidden = false,
}: {
    item: Stories24RailItem;
    /** 0-based story index; the card paints `index + 1`. Null/omit for Add yours. */
    index?: number | null;
    onPress: (rect: CardRect) => void;
    registerCardRef: (handle: string, node: View | null) => void;
    playPreviewVideo: boolean;
    previewVideosPaused: boolean;
    morphHidden?: boolean;
}) {
    const cardRef = useRef<View>(null);
    const { user } = useAuth();
    const handleKey = normalizeStories24Handle(item.handle);
    const isAddYours = item.handle === STORIES24_ADD_YOURS_HANDLE;
    const displayHandle = item.handle.startsWith('@') ? item.handle : `@${item.handle.replace(/^@/, '')}`;
    const isOwnStory =
        !!user?.handle && normalizeStories24Handle(user.handle) === handleKey;
    useEffect(() => {
        if (isOwnStory && user?.handle && user.avatarUrl) {
            setAvatarForHandle(user.handle, user.avatarUrl);
        }
    }, [isOwnStory, user?.handle, user?.avatarUrl]);
    // Own stories must match Passport / feed header: Auth avatar wins over stale API
    // `avatar_url` (and over mock getAvatarForHandle Unsplash seeds).
    const avatarSrc = isOwnStory
        ? user?.avatarUrl || item.avatarUrl || getAvatarForHandle(item.handle)
        : item.avatarUrl || getAvatarForHandle(item.handle);

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

    const stillUri = usableRailStill(item.thumb);

    if (isAddYours) {
        return (
            <View ref={setCardRef} collapsable={false} style={morphHidden ? styles.cardMorphHidden : undefined}>
                <TouchableOpacity
                    style={[styles.card, styles.addYoursCard]}
                    onPress={measureAndPress}
                    activeOpacity={0.9}
                >
                    <View style={styles.addYoursInner}>
                        <View style={styles.addYoursIconCircle}>
                            <FeedPlusIcon size={16} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.addYoursTitle} numberOfLines={1}>
                            Add yours
                        </Text>
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
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                {item.previewVideoUrl ? (
                    <StoryPreviewVideo
                        uri={item.previewVideoUrl}
                        posterUri={stillUri}
                        paused={previewVideosPaused || !playPreviewVideo}
                    />
                ) : stillUri ? (
                    <CachedImage
                        source={{ uri: stillUri }}
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
                    colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)']}
                    locations={[0, 0.4, 1]}
                    style={styles.cardFooterGrad}
                />
                {typeof index === 'number' ? (
                    <Text pointerEvents="none" numberOfLines={1} style={styles.cardRank}>
                        {index + 1}
                    </Text>
                ) : null}
                <View style={styles.cardAvatarCenter} pointerEvents="none">
                    <LinearGradient
                        colors={[...STORY_GRADIENT_RING_COLORS]}
                        start={STORY_GRADIENT_RING_START}
                        end={STORY_GRADIENT_RING_END}
                        style={styles.cardAvatarRing}
                    >
                        <View style={styles.cardAvatarRingInner}>
                            <Avatar
                                src={avatarSrc}
                                name={displayHandle.replace(/^@/, '').split('@')[0] || 'User'}
                                size={CARD_AVATAR_PHOTO}
                                hideBorder
                            />
                        </View>
                    </LinearGradient>
                </View>
                <View style={styles.cardFooter}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
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
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {stillUri ? (
                        <CachedImage source={{ uri: stillUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            {stillUri ? (
                                <CachedImage
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

    // Rail render only: top 9 story cards (+ Add yours). `railHandles` above stays uncapped
    // so the full-screen viewer keeps swiping past rank 9.
    const displayCards = useMemo(() => rankStories24RailItems(items), [items]);

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
        <View collapsable={false} style={styles.root}>
            <View style={styles.headerRow}>
                <Stories24MapPinIcon size={16} color="#FFFFFF" />
                <Text style={styles.railTitle}>Stories 24</Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                onScrollBeginDrag={() => setRailScrolling(true)}
                onScrollEndDrag={() => setRailScrolling(false)}
                onMomentumScrollEnd={() => setRailScrolling(false)}
            >
                {displayCards.map(({ item, index }) => {
                    const handleKey = normalizeStories24Handle(item.handle);
                    // Keep the source card visible until the morph clone has a paintable frame.
                    const morphHidden =
                        (!!expanding &&
                            expandHideSource &&
                            normalizeStories24Handle(expanding.item.handle) === handleKey) ||
                        (!!collapsing &&
                            collapseHideSource &&
                            normalizeStories24Handle(collapsing.payload.handle) === handleKey);
                    return (
                        <StoryCard
                            key={
                                item.handle === STORIES24_ADD_YOURS_HANDLE
                                    ? 'add-yours'
                                    : item.handle
                            }
                            item={item}
                            index={index}
                            registerCardRef={registerCardRef}
                            morphHidden={morphHidden}
                            playPreviewVideo={
                                !!item.previewVideoUrl && item.handle === firstStoryPreviewHandle
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
    root: {
        paddingVertical: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 6,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    railTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    scrollContent: {
        paddingLeft: 16,
        paddingRight: 16,
        gap: 10,
        columnGap: 10,
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    addYoursCard: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        borderStyle: 'solid',
    },
    addYoursInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        columnGap: 8,
        paddingHorizontal: 12,
    },
    addYoursIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addYoursTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    cardFooterGrad: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 44,
    },
    cardAvatarCenter: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        // Sit slightly above true center so the footer text doesn't crowd it.
        paddingBottom: 10,
    },
    cardAvatarRing: {
        width: CARD_AVATAR_RING,
        height: CARD_AVATAR_RING,
        borderRadius: CARD_AVATAR_RING / 2,
        padding: STORY_RING_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 4,
        elevation: 4,
    },
    cardAvatarRingInner: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
        padding: STORY_RING_GAP,
        // Opaque so the gradient ring doesn't fill the standoff — same 2.5px
        // newsfeed gap, readable over the story thumbnail.
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    cardFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 2,
        alignItems: 'center',
        // Paint the byline over the rank watermark so long titles stay readable.
        zIndex: 2,
    },
    /** NOW TV / Netflix-style rank number, bottom-left of every story card. */
    cardRank: {
        position: 'absolute',
        left: 8,
        bottom: 4,
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 44,
        lineHeight: 46,
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        zIndex: 1,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 13,
        textAlign: 'center',
    },
    cardSubtitle: {
        color: '#A5B4FC',
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        includeFontPadding: false,
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
        ...StyleSheet.absoluteFill,
        backgroundColor: '#000000',
    },
    collapseVeil: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    expandCard: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#000000',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.45,
        shadowRadius: 30,
        elevation: 16,
    },
    expandDim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    cardMorphHidden: {
        opacity: 0,
    },
});
