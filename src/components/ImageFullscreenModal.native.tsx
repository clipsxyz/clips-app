import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    View,
    Image,
    StyleSheet,
    Text,
    StatusBar,
    ScrollView,
    Pressable,
    useWindowDimensions,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { collectFeedImageUrls } from '../utils/feedImageFullscreen';
import { getImageFullscreenLaunch, clearImageFullscreenLaunch } from '../utils/imageFullscreenLaunchNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
} from '../utils/effectiveTextPostStyleNative';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar.native';
import { useAuth } from '../context/Auth';
import { ox } from '../constants/nativeOpticalScale';

/**
 * Fast fade-rise into fullscreen. Short travel so the open does not feel sticky.
 */
const EXPAND_MS = 200;
const COLLAPSE_MS = 170;
const BACKDROP_IN_MS = 140;
const BACKDROP_OUT_MS = 140;
const EXPAND_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const COLLAPSE_EASE = Easing.bezier(0.4, 0, 1, 1);
const EXPAND_FALLBACK_MS = EXPAND_MS + 40;
const COLLAPSE_FALLBACK_MS = COLLAPSE_MS + 40;

export type ImageFullscreenOrigin = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Props = {
    post: Post | null;
    visible: boolean;
    /** Slide to show first when opening (feed carousel parity). */
    initialIndex?: number;
    /** Feed card media rect — drives card → fullscreen expand (web parity). */
    originRect?: ImageFullscreenOrigin | null;
    onClose: () => void;
    onLike?: () => void | Promise<void>;
    onComment?: () => void;
    onReclip?: () => void | Promise<void>;
    onShare?: () => void;
    onSave?: () => void;
    isSaved?: boolean;
    onMenu?: () => void;
    onFollow?: () => void | Promise<void>;
    onVisitProfile?: () => void;
};

function collectImageUrls(post: Post): string[] {
    return collectFeedImageUrls(post);
}

function compactCount(n: number | undefined): string {
    const v = Math.max(0, Number(n) || 0);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
    return String(v);
}

function displayNameFromHandle(handle: string): string {
    const raw = String(handle || '').trim();
    if (!raw) return 'User';
    return raw.split('@')[0] || raw;
}

function atHandle(handle: string): string {
    const raw = String(handle || '').trim();
    if (!raw) return '';
    return raw.startsWith('@') ? raw : `@${raw}`;
}

/**
 * Still-image viewer — short fade-rise open / close.
 */
export default function ImageFullscreenModal({
    post,
    visible,
    initialIndex = 0,
    originRect = null,
    onClose,
    onLike,
    onComment,
    onReclip,
    onShare,
    onSave,
    isSaved = false,
    onMenu,
    onFollow,
    onVisitProfile,
}: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [likeBusy, setLikeBusy] = useState(false);
    const [shellReady, setShellReady] = useState(false);
    const [closing, setClosing] = useState(false);
    const [imageCover, setImageCover] = useState(true);
    /** APK: show Twitter chrome via React state (Reanimated opacity under HW texture was invisible). */
    const [chromeShown, setChromeShown] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const skipScrollSyncRef = useRef(false);
    const originRef = useRef<ImageFullscreenOrigin | null>(null);
    const images = useMemo(() => {
        const fromPost = post ? collectImageUrls(post) : [];
        if (fromPost.length > 0) return fromPost;
        const launch = getImageFullscreenLaunch();
        if (launch && post && String(launch.post.id) === String(post.id) && launch.urls.length > 0) {
            return launch.urls;
        }
        return launch?.urls ?? [];
    }, [post]);
    const textBody = (post?.text || post?.caption || '').trim();
    const isTextOnly = images.length === 0 && Boolean(textBody);

    const progress = useSharedValue(0);
    const backdropOp = useSharedValue(0);
    const screenH = useSharedValue(screenHeight);

    useEffect(() => {
        screenH.value = screenHeight;
    }, [screenH, screenHeight]);

    const expandFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeFinishedRef = useRef(false);

    const markExpanded = useCallback(() => {
        setShellReady(true);
        setClosing(false);
        setImageCover(false);
        setChromeShown(true);
        setChromeVisible(true);
    }, []);

    const finishClose = useCallback(() => {
        if (closeFinishedRef.current) return;
        closeFinishedRef.current = true;
        if (closeFallbackTimerRef.current) {
            clearTimeout(closeFallbackTimerRef.current);
            closeFallbackTimerRef.current = null;
        }
        setShellReady(false);
        setClosing(false);
        setImageCover(true);
        setChromeShown(false);
        clearImageFullscreenLaunch();
        onClose();
    }, [onClose]);

    const runExpand = useCallback(() => {
        if (originRect && originRect.width > 8 && originRect.height > 8) {
            originRef.current = originRect;
        }

        cancelAnimation(progress);
        cancelAnimation(backdropOp);
        if (expandFallbackTimerRef.current) {
            clearTimeout(expandFallbackTimerRef.current);
            expandFallbackTimerRef.current = null;
        }

        progress.value = 0;
        backdropOp.value = 0;
        setShellReady(false);
        setChromeShown(false);
        setChromeVisible(true);
        setClosing(false);
        setImageCover(false);
        closeFinishedRef.current = false;

        requestAnimationFrame(() => {
            backdropOp.value = withTiming(1, {
                duration: BACKDROP_IN_MS,
                easing: Easing.out(Easing.cubic),
            });
            progress.value = withTiming(
                1,
                { duration: EXPAND_MS, easing: EXPAND_EASE },
                (finished) => {
                    if (finished) runOnJS(markExpanded)();
                },
            );
            expandFallbackTimerRef.current = setTimeout(() => {
                expandFallbackTimerRef.current = null;
                markExpanded();
            }, EXPAND_FALLBACK_MS);
        });
    }, [backdropOp, markExpanded, originRect, progress]);

    const requestClose = useCallback(() => {
        if (closing) return;
        setClosing(true);
        setChromeVisible(false);
        setChromeShown(false);
        // Keep contain during slide-down — switching to cover left a card-shaped “shadow”.
        setShellReady(false);

        cancelAnimation(progress);
        cancelAnimation(backdropOp);
        if (expandFallbackTimerRef.current) {
            clearTimeout(expandFallbackTimerRef.current);
            expandFallbackTimerRef.current = null;
        }

        // Fade backdrop with the slide so nothing floats over the feed.
        backdropOp.value = withTiming(0, {
            duration: BACKDROP_OUT_MS,
            easing: Easing.in(Easing.cubic),
        });
        progress.value = withTiming(
            0,
            { duration: COLLAPSE_MS, easing: COLLAPSE_EASE },
            (finished) => {
                if (finished) runOnJS(finishClose)();
            },
        );
        closeFallbackTimerRef.current = setTimeout(() => {
            closeFallbackTimerRef.current = null;
            finishClose();
        }, COLLAPSE_FALLBACK_MS);
    }, [backdropOp, closing, finishClose, progress]);

    useEffect(() => {
        if (!visible || !post) return;
        runExpand();
        return () => {
            if (expandFallbackTimerRef.current) {
                clearTimeout(expandFallbackTimerRef.current);
                expandFallbackTimerRef.current = null;
            }
        };
    }, [visible, post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!visible) return;
        setLikeBusy(false);
    }, [visible, post?.id]);

    useEffect(() => {
        if (!visible || isTextOnly) return;
        const max = Math.max(0, images.length - 1);
        const next = Math.min(Math.max(0, initialIndex), max);
        setIndex(next);
        skipScrollSyncRef.current = true;
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: false });
        requestAnimationFrame(() => {
            skipScrollSyncRef.current = false;
        });
    }, [visible, post?.id, initialIndex, images.length, screenWidth, isTextOnly]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOp.value,
    }));

    /** Fullscreen panel fades in and rises a short distance — not a full-height slide. */
    const shellStyle = useAnimatedStyle(() => {
        const p = progress.value;
        const h = Math.max(1, screenH.value);
        return {
            position: 'absolute' as const,
            left: 0,
            top: 0,
            width: '100%' as const,
            height: h,
            backgroundColor: '#000000',
            opacity: interpolate(p, [0, 0.22, 1], [0, 1, 1]),
            transform: [{ translateY: interpolate(p, [0, 1], [Math.round(h * 0.12), 0]) }],
        };
    });

    if (!post) return null;

    const handle = post.userHandle || '';
    const name = displayNameFromHandle(handle);
    const handleLabel = atHandle(handle);
    const isOwn = Boolean(user?.handle && handle && user.handle === handle);
    const isFollowing = post.isFollowing === true;
    const authorAvatar = getAvatarForHandle(handle);
    const viewerAvatar = user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined);

    const headerPadTop = insets.top + 6;
    const footerPadBottom = Math.max(insets.bottom, 12);
    /** Don't gate on chromeShown — that hid UI when HW layers ate sibling overlays. */
    const showChrome = chromeVisible && !closing;
    const imageResizeMode = imageCover && !closing && !shellReady ? 'cover' : 'contain';

    const toggleChrome = () => {
        if (closing) return;
        setChromeVisible((v) => !v);
    };

    const handleLikePress = async () => {
        if (!onLike || likeBusy) return;
        setLikeBusy(true);
        try {
            await onLike();
        } finally {
            setLikeBusy(false);
        }
    };

    const hasCarousel = images.length > 1;

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (skipScrollSyncRef.current) return;
        const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
        setIndex(Math.max(0, Math.min(next, images.length - 1)));
    };

    if (!images.length && !isTextOnly) {
        return (
            <Modal
                visible={visible}
                animationType="none"
                transparent
                statusBarTranslucent
                onRequestClose={requestClose}
            >
                <GestureHandlerRootView style={styles.flex}>
                    <View style={[styles.flex, styles.emptyRoot, { backgroundColor: '#000' }]}>
                        <StatusBar barStyle="light-content" backgroundColor="#000000" />
                        <Pressable
                            style={[styles.iconBtn, { top: insets.top + 8, left: 8 }]}
                            onPress={requestClose}
                            hitSlop={8}
                        >
                            <Icon name="close" size={ox(24)} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.emptyText}>No image to show</Text>
                    </View>
                </GestureHandlerRootView>
            </Modal>
        );
    }

    const animating = !chromeShown || closing;

    const mediaStage = (
        <View style={styles.stage}>
            {isTextOnly ? (
                <Pressable style={styles.textStage} onPress={toggleChrome}>
                    <View
                        style={[
                            styles.textCard,
                            { backgroundColor: getTextOnlyBackgroundColor(post) },
                        ]}
                    >
                        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                            <Text
                                style={[
                                    styles.textCardBody,
                                    {
                                        color: getTextOnlyTextColor(post),
                                        fontSize: getTextOnlyFontSize(post),
                                    },
                                ]}
                            >
                                {textBody}
                            </Text>
                        </ScrollView>
                    </View>
                </Pressable>
            ) : hasCarousel ? (
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    onMomentumScrollEnd={onScrollEnd}
                    style={animating ? styles.stageFill : { width: screenWidth, height: screenHeight }}
                    scrollEnabled={shellReady && !closing}
                >
                    {images.map((uri) => (
                        <Pressable
                            key={uri}
                            onPress={toggleChrome}
                            style={
                                animating
                                    ? styles.stageFill
                                    : { width: screenWidth, height: screenHeight }
                            }
                        >
                            <Image
                                source={{ uri }}
                                style={styles.image}
                                resizeMode={imageResizeMode}
                            />
                        </Pressable>
                    ))}
                </ScrollView>
            ) : (
                <Pressable
                    onPress={toggleChrome}
                    style={animating ? styles.stageFill : { width: screenWidth, height: screenHeight }}
                >
                    <Image
                        source={{ uri: images[0] }}
                        style={styles.image}
                        resizeMode={imageResizeMode}
                    />
                </Pressable>
            )}
        </View>
    );

    const chromeOverlay = showChrome ? (
        <View style={styles.chromeRoot} pointerEvents="box-none">
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={toggleChrome}
                accessibilityLabel="Toggle controls"
            />
            <Pressable
                style={[styles.closeFab, { top: insets.top + 10 }]}
                onPress={requestClose}
                hitSlop={10}
                accessibilityLabel="Close fullscreen"
            >
                <Icon name="close" size={ox(22)} color="#FFFFFF" />
            </Pressable>

            <View
                style={[styles.header, { paddingTop: headerPadTop, paddingLeft: 52 }]}
                pointerEvents="box-none"
            >
                <Pressable
                    style={styles.authorBlock}
                    onPress={onVisitProfile}
                    disabled={!onVisitProfile}
                >
                    <Avatar src={authorAvatar} name={name} size={ox(34)} />
                    <View style={styles.authorText}>
                        <Text style={styles.authorName} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.authorHandle} numberOfLines={1}>
                            {handleLabel}
                        </Text>
                    </View>
                </Pressable>

                {!isOwn && onFollow ? (
                    <Pressable
                        style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                        onPress={() => void onFollow()}
                        hitSlop={6}
                    >
                        <Text
                            style={[
                                styles.followBtnText,
                                isFollowing && styles.followBtnTextActive,
                            ]}
                        >
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </Pressable>
                ) : (
                    <View style={styles.followSpacer} />
                )}

                {onMenu ? (
                    <Pressable
                        style={styles.iconBtnInline}
                        onPress={onMenu}
                        hitSlop={8}
                        accessibilityLabel="More options"
                    >
                        <Icon name="ellipsis-vertical" size={ox(20)} color="#FFFFFF" />
                    </Pressable>
                ) : null}
            </View>

            {hasCarousel ? (
                <View
                    style={[styles.carouselIndexBadge, { top: headerPadTop + 14 }]}
                    pointerEvents="none"
                >
                    <Text style={styles.carouselIndex}>
                        {index + 1}/{images.length}
                    </Text>
                </View>
            ) : null}

            <View
                style={[styles.chromeFooter, { paddingBottom: footerPadBottom }]}
                pointerEvents="box-none"
            >
                <View style={styles.engagementRow}>
                    <Pressable
                        style={styles.engItem}
                        onPress={onComment}
                        hitSlop={8}
                        accessibilityLabel="Reply"
                    >
                        <Icon name="chatbubble-outline" size={ox(20)} color="#8B98A5" />
                        <Text style={styles.engCount}>{compactCount(post.stats?.comments)}</Text>
                    </Pressable>
                    <Pressable
                        style={styles.engItem}
                        onPress={() => void onReclip?.()}
                        hitSlop={8}
                        accessibilityLabel="Reclip"
                    >
                        <Icon
                            name="repeat"
                            size={ox(20)}
                            color={post.userReclipped ? '#00BA7C' : '#8B98A5'}
                        />
                        <Text style={styles.engCount}>{compactCount(post.stats?.reclips)}</Text>
                    </Pressable>
                    <Pressable
                        style={styles.engItem}
                        onPress={() => void handleLikePress()}
                        disabled={likeBusy}
                        hitSlop={8}
                        accessibilityLabel="Like"
                    >
                        <Icon
                            name={post.userLiked ? 'heart' : 'heart-outline'}
                            size={ox(20)}
                            color={post.userLiked ? '#F91880' : '#8B98A5'}
                        />
                        <Text style={styles.engCount}>{compactCount(post.stats?.likes)}</Text>
                    </Pressable>
                    <View style={styles.engItem} pointerEvents="none">
                        <Icon name="bar-chart-outline" size={ox(20)} color="#8B98A5" />
                        <Text style={styles.engCount}>{compactCount(post.stats?.views)}</Text>
                    </View>
                    {onSave ? (
                        <Pressable
                            style={styles.engIconOnly}
                            onPress={onSave}
                            hitSlop={8}
                            accessibilityLabel={isSaved ? 'Saved' : 'Save'}
                        >
                            <Icon
                                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                                size={ox(20)}
                                color={isSaved ? '#1D9BF0' : '#8B98A5'}
                            />
                        </Pressable>
                    ) : null}
                    <Pressable
                        style={styles.engIconOnly}
                        onPress={onShare}
                        hitSlop={8}
                        accessibilityLabel="Share"
                    >
                        <Icon name="share-outline" size={ox(20)} color="#8B98A5" />
                    </Pressable>
                </View>

                <View style={styles.replyBar}>
                    <Avatar
                        src={viewerAvatar}
                        name={user?.name || user?.handle || 'You'}
                        size={ox(32)}
                    />
                    <Pressable style={styles.replyField} onPress={onComment}>
                        <Text style={styles.replyPlaceholder}>Post your reply</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    ) : (
        <View style={styles.chromeRoot} pointerEvents="box-none">
            <Pressable
                style={[styles.closeFab, { top: insets.top + 10 }]}
                onPress={requestClose}
                hitSlop={10}
                accessibilityLabel="Close fullscreen"
            >
                <Icon name="close" size={ox(22)} color="#FFFFFF" />
            </Pressable>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent
            statusBarTranslucent
            onRequestClose={requestClose}
        >
            <GestureHandlerRootView style={styles.modalRoot}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />

                {animating ? (
                    <>
                        <Animated.View style={[styles.shell, shellStyle]} collapsable={false}>
                            <View style={styles.shellInner} collapsable={false}>
                                {mediaStage}
                            </View>
                        </Animated.View>
                        <View style={styles.chromeRoot} pointerEvents="box-none">
                            <Pressable
                                style={[styles.closeFab, { top: insets.top + 10 }]}
                                onPress={requestClose}
                                hitSlop={10}
                                accessibilityLabel="Close fullscreen"
                            >
                                <Icon name="close" size={ox(22)} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    </>
                ) : (
                    /* Plain settled tree — chrome is a sibling of the image, not of a Reanimated layer. */
                    <View style={styles.settledRoot} collapsable={false}>
                        <View style={styles.shellInner} collapsable={false}>
                            {mediaStage}
                        </View>
                        {chromeOverlay}
                    </View>
                )}
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    modalRoot: {
        flex: 1,
        ...StyleSheet.absoluteFill,
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#000000',
    },
    shell: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#000000',
        // No elevation/shadow — closing morphs used to leave a floating card ghost.
        elevation: 0,
    },
    settledRoot: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#000000',
    },
    shellInner: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
    },
    chromeRoot: {
        ...StyleSheet.absoluteFill,
        zIndex: 20,
        elevation: 20,
    },
    closeFabWrap: {
        position: 'absolute',
        left: 12,
        zIndex: 30,
        elevation: 30,
    },
    closeFab: {
        position: 'absolute',
        left: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 30,
        elevation: 30,
    },
    headerCloseSpacer: {
        width: 44,
        height: 44,
    },
    chromeLayer: {
        ...StyleSheet.absoluteFill,
        zIndex: 20,
        elevation: 20,
    },
    stage: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stageFill: {
        ...StyleSheet.absoluteFillObject,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingBottom: 8,
        gap: 4,
        zIndex: 30,
        elevation: 30,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    chromeFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        elevation: 30,
        backgroundColor: 'rgba(0,0,0,0.92)',
    },
    iconBtn: {
        position: 'absolute',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
    },
    iconBtnInline: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    authorBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        paddingRight: 6,
    },
    authorText: {
        flex: 1,
        minWidth: 0,
    },
    authorName: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    authorHandle: {
        color: '#8B98A5',
        fontSize: 13,
        fontWeight: '400',
        marginTop: 1,
    },
    followBtn: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.85)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginRight: 2,
    },
    followBtnActive: {
        borderColor: 'rgba(255,255,255,0.45)',
    },
    followBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    followBtnTextActive: {
        color: '#FFFFFF',
    },
    followSpacer: {
        width: 8,
    },
    carouselIndexBadge: {
        position: 'absolute',
        alignSelf: 'center',
        right: 16,
        zIndex: 41,
    },
    carouselIndex: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        overflow: 'hidden',
    },
    engagementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    engItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 44,
        paddingHorizontal: 2,
    },
    engIconOnly: {
        minHeight: 44,
        minWidth: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    engCount: {
        color: '#8B98A5',
        fontSize: 13,
        fontWeight: '400',
        fontVariant: ['tabular-nums'],
    },
    replyBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    replyField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16181C',
        borderRadius: 999,
        paddingLeft: 14,
        paddingRight: 14,
        minHeight: 40,
    },
    replyPlaceholder: {
        flex: 1,
        color: '#8B98A5',
        fontSize: 15,
    },
    emptyRoot: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#D1D5DB',
        fontSize: 15,
        fontWeight: '500',
    },
    textStage: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    textCard: {
        borderRadius: 18,
        maxHeight: '78%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 22,
        paddingVertical: 28,
    },
    textCardBody: {
        fontWeight: '600',
        lineHeight: 28,
    },
});
