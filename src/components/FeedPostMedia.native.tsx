import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { StickerOverlay } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { ViewType, type VideoRef } from 'react-native-video';
import type { Post } from '../types';
import { subscribeActiveFeedVideo } from '../utils/feedActiveVideoNative';
import { consumeFeedVideoHandoff, setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia } from '../utils/postMedia';
import {
    MOCK_FEED_VIDEO_REMOTE_FALLBACK,
    isMockDemoVideoPath,
    mockFeedVideoSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import { FEED_CARD_MEDIA_TAP_LAYER } from './FeedPageLayout.native';
import VideoCTAOverlay from './VideoCTAOverlay.native';
import FeedVideoCaptionOverlay from './FeedVideoCaptionOverlay.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';

export type FeedPostMediaHandle = {
    toggleVideoMute: () => void;
    /** Web feed: single tap re-shows mute icon for ~2s without toggling. */
    flashMuteControl: () => void;
    /** Parent tap layer can trigger in-media burst at local coords. */
    showLikeBurstAt: (x: number, y: number) => void;
};

type Props = {
    post: Post;
    /** When set, shows that carousel slide instead of the first item. */
    carouselIndex?: number;
    onCarouselIndexChange?: (index: number) => void;
    width: number;
    height: number;
    /** @deprecated Feed uses onDoubleLike + onSingleTap (TextCard parity). */
    onPress?: (event?: GestureResponderEvent) => void;
    /** Feed: double-tap like (web Media / TextCard parity). Optional local tap coords. */
    onDoubleLike?: (x?: number, y?: number) => void;
    /** Feed: single-tap — image fullscreen or video mute flash (web Media). */
    onSingleTap?: () => void;
    stickers?: StickerOverlay[];
    onMediaLoad?: () => void;
    mode?: 'feed' | 'detail';
    /** Feed only: true when this card is the active autoplay target. */
    isActive?: boolean;
    /** Feed autoplay is muted by default (global mute pref). */
    muted?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Feed video: opens vertical Scenes viewer. */
    onOpenScenes?: () => void;
};

const FeedPostMedia = React.forwardRef<FeedPostMediaHandle, Props>(function FeedPostMedia(
    {
        post,
        carouselIndex = 0,
        onCarouselIndexChange,
        width,
        height,
        onPress,
        onDoubleLike,
        onSingleTap,
        stickers,
        onMediaLoad,
        mode = 'feed',
        isActive = false,
        muted = true,
        style,
        onOpenScenes,
    },
    ref,
) {
    const [loadingByUrl, setLoadingByUrl] = useState<Record<string, boolean>>({});
    const [paused, setPaused] = useState(mode === 'feed');
    const [playFailed, setPlayFailed] = useState(false);
    /** Per-raw-URL remote fallback after local/demo path fails (mirrors web Media). */
    const [videoUrlFallbackByRaw, setVideoUrlFallbackByRaw] = useState<Record<string, string>>({});
    const [soundOn, setSoundOn] = useState(!muted);
    const [muteFlash, setMuteFlash] = useState(false);
    const loadedUrlsRef = useRef<Set<string>>(new Set());
    const mediaLoadReportedRef = useRef(false);
    const carouselScrollRef = useRef<ScrollView>(null);
    const feedVideoRef = useRef<VideoRef>(null);
    const lastEmittedIndexRef = useRef(0);
    const clearBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);

    const carouselItems = useMemo(
        () =>
            (post.mediaItems || []).filter(
                (item) => item?.type === 'image' || item?.type === 'video',
            ),
        [post.mediaItems],
    );
    const hasCarousel = carouselItems.length > 1;
    const maxCarouselIndex = Math.max(0, carouselItems.length - 1);
    const safeCarouselIndex = Math.min(Math.max(0, carouselIndex), maxCarouselIndex);
    const [currentIndex, setCurrentIndex] = useState(safeCarouselIndex);
    /** Mount native Video only after this card has been active once (keeps initial feed load stable). */
    const [feedVideoReady, setFeedVideoReady] = useState(mode !== 'feed');

    useEffect(() => {
        if (mode === 'feed' && isActive) {
            setFeedVideoReady(true);
        }
    }, [mode, isActive]);

    const markUrlLoaded = useCallback(
        (url: string) => {
            loadedUrlsRef.current.add(url);
            setLoadingByUrl((prev) => {
                if (!prev[url]) return prev;
                const next = { ...prev };
                delete next[url];
                return next;
            });
            if (!mediaLoadReportedRef.current) {
                mediaLoadReportedRef.current = true;
                onMediaLoad?.();
            }
        },
        [onMediaLoad],
    );

    const beginUrlLoad = useCallback((url: string) => {
        if (loadedUrlsRef.current.has(url)) return;
        setLoadingByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
    }, []);

    const onCarouselScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!hasCarousel || !width) return;
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            const clamped = Math.max(0, Math.min(next, maxCarouselIndex));
            if (clamped === currentIndex) return;
            lastEmittedIndexRef.current = clamped;
            setCurrentIndex(clamped);
            requestAnimationFrame(() => onCarouselIndexChange?.(clamped));
        },
        [currentIndex, hasCarousel, maxCarouselIndex, onCarouselIndexChange, width],
    );

    useEffect(() => {
        loadedUrlsRef.current.clear();
        mediaLoadReportedRef.current = false;
        setLoadingByUrl({});
        setCurrentIndex(0);
        lastEmittedIndexRef.current = 0;
        setPlayFailed(false);
        setVideoUrlFallbackByRaw({});
    }, [post.id]);

    /** Thumb-rail tap only — do not scrollTo when the swipe already moved us there. */
    useEffect(() => {
        if (!hasCarousel || !width) return;
        if (safeCarouselIndex === currentIndex) return;
        if (safeCarouselIndex === lastEmittedIndexRef.current) {
            setCurrentIndex(safeCarouselIndex);
            return;
        }
        lastEmittedIndexRef.current = safeCarouselIndex;
        setCurrentIndex(safeCarouselIndex);
        carouselScrollRef.current?.scrollTo({ x: safeCarouselIndex * width, animated: false });
    }, [currentIndex, hasCarousel, safeCarouselIndex, width]);

    const activeItem =
        carouselItems.length > 0
            ? carouselItems[Math.min(currentIndex, maxCarouselIndex)]
            : undefined;
    const rawMediaUrl = activeItem?.url || post.mediaUrl;
    const getPlaybackUrl = (raw: string) =>
        videoUrlFallbackByRaw[raw] || resolveMockFeedVideoUrl(raw);
    const mediaUrl = rawMediaUrl;
    const playbackUrl = rawMediaUrl ? getPlaybackUrl(rawMediaUrl) : undefined;
    const postLevelPoster = post.videoPosterUrl;
    const activeIsVideo = activeItem?.type === 'video' || (!activeItem && isVideoPost(post));
    const activeIsImage = !activeIsVideo && !!mediaUrl;
    const imageText =
        activeIsImage && post.imageText ? String(post.imageText).trim() : '';

    const textOnly = isTextOnlyPost(post);
    const video = !textOnly && activeIsVideo && !!mediaUrl;
    const showScenesCta =
        mode === 'feed' &&
        video &&
        postHasVideoMedia(post) &&
        Boolean(onOpenScenes);
    const feedShouldPlay = mode === 'feed' && video && isActive && !playFailed;
    const showMuteButton = video && mode === 'feed' && (feedShouldPlay || muteFlash);

    const onFeedVideoProgress = (currentTime: number) => {
        if (mode !== 'feed' || !isActive) return;
        setFeedVideoHandoff(post.id, { currentTime, muted: !soundOn });
    };

    const fireBurstAt = useCallback((x: number, y: number) => {
        setBurstAt({ x, y });
        setBurstKey((k) => k + 1);
        if (clearBurstTimerRef.current) {
            clearTimeout(clearBurstTimerRef.current);
        }
        clearBurstTimerRef.current = setTimeout(() => {
            setBurstAt(null);
            clearBurstTimerRef.current = null;
        }, 700);
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            toggleVideoMute: () => {
                if (!video || mode !== 'feed') return;
                setFeedSoundOn(!soundOn);
                setMuteFlash(true);
                setTimeout(() => setMuteFlash(false), 1100);
            },
            flashMuteControl: () => {
                if (!video || mode !== 'feed') return;
                setMuteFlash(true);
                setTimeout(() => setMuteFlash(false), 2000);
            },
            showLikeBurstAt: (x: number, y: number) => {
                fireBurstAt(x, y);
            },
        }),
        [fireBurstAt, mode, soundOn, video],
    );

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        setPlayFailed(false);
        if (mediaUrl) beginUrlLoad(mediaUrl);
    }, [mediaUrl, mode, video, beginUrlLoad]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        return subscribeActiveFeedVideo((activeId) => {
            if (activeId !== post.id) {
                setPlayFailed(false);
                setPaused(true);
            }
        });
    }, [mode, post.id, video]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        setPaused(!isActive);
    }, [isActive, mode, video]);

    useEffect(() => {
        if (mode !== 'feed' || !video || !isActive) return;
        const handoff = consumeFeedVideoHandoff(post.id);
        if (!handoff || handoff.currentTime <= 0) {
            if (handoff) setSoundOn(!handoff.muted);
            return;
        }
        setSoundOn(!handoff.muted);
        requestAnimationFrame(() => {
            feedVideoRef.current?.seek(handoff.currentTime);
        });
    }, [isActive, mode, post.id, video]);

    useEffect(() => {
        setSoundOn(!muted);
    }, [muted, post.id]);

    const textOnlyStyle = useMemo(() => {
        if (!textOnly) return null;
        return {
            backgroundColor: getTextOnlyBackgroundColor(post),
            color: getTextOnlyTextColor(post),
            fontSize: getTextOnlyFontSize(post),
        };
    }, [post, textOnly]);

    const feedTapCapture =
        mode === 'feed' && Boolean(onDoubleLike || onSingleTap || onPress);

    /** Native Image/Video steal touches on Android — never let them take the responder in feed. */
    const mediaPointerEvents = feedTapCapture ? ('none' as const) : undefined;

    const handleFullscreen = useCallback(() => {
        if (onPress && !onDoubleLike && !onSingleTap) {
            onPress();
            return;
        }
        onSingleTap?.();
    }, [onDoubleLike, onPress, onSingleTap]);

    const handleLikeAt = useCallback(
        (x: number, y: number) => {
            // Tap layer is inset from media top — map into media-local coords.
            const localX = Number.isFinite(x) ? x : width / 2;
            const localY = Number.isFinite(y)
                ? y + (typeof FEED_CARD_MEDIA_TAP_LAYER.top === 'number' ? FEED_CARD_MEDIA_TAP_LAYER.top : 0)
                : height / 2;
            // Parent renders window-level burst (Android TextureView-safe).
            onDoubleLike?.(localX, localY);
        },
        [height, onDoubleLike, width],
    );

    const mediaTapGesture = useMemo(() => {
        const doubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(250)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleLikeAt)(e.x, e.y);
            });
        const singleTap = Gesture.Tap()
            .numberOfTaps(1)
            .onEnd((_e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleFullscreen)();
            });
        // Delay single until double fails (RNGH: requireExternalGestureToFail ≈ requireToFail).
        singleTap.requireExternalGestureToFail(doubleTap);
        const exclusive = Gesture.Exclusive(doubleTap, singleTap);
        // Carousel: allow horizontal ScrollView pans alongside Exclusive taps.
        if (hasCarousel) {
            return Gesture.Simultaneous(Gesture.Native(), exclusive);
        }
        return exclusive;
    }, [handleFullscreen, handleLikeAt, hasCarousel]);

    useEffect(
        () => () => {
            if (clearBurstTimerRef.current) {
                clearTimeout(clearBurstTimerRef.current);
            }
        },
        [],
    );

    const handleOpenScenesPress = useCallback(() => {
        onOpenScenes?.();
    }, [onOpenScenes]);

    const feedVideoSurfaceProps =
        Platform.OS === 'android' && mode === 'feed'
            ? { viewType: ViewType.TEXTURE as const, useTextureView: true, disableFocus: true as const }
            : {};

    const renderFeedTapOverlay = () => {
        // Non-carousel: transparent overlay (Image/Video steal touches on Android).
        // Carousel: GestureDetector wraps the ScrollView instead (see return).
        if (!feedTapCapture || hasCarousel) return null;
        return (
            <GestureDetector gesture={mediaTapGesture}>
                <View
                    style={FEED_CARD_MEDIA_TAP_LAYER}
                    collapsable={false}
                    accessibilityRole="button"
                    accessibilityLabel="Double tap to like"
                />
            </GestureDetector>
        );
    };

    if (textOnly) {
        return (
            <Pressable onPress={onPress} style={[styles.wrap, { width, minHeight: height * 0.55 }, style]}>
                <View style={[styles.textOnlyCard, { backgroundColor: textOnlyStyle?.backgroundColor }]}>
                    <Text style={[styles.textOnlyBody, { color: textOnlyStyle?.color, fontSize: textOnlyStyle?.fontSize }]}>
                        {post.text}
                    </Text>
                </View>
            </Pressable>
        );
    }

    if (!mediaUrl) {
        return null;
    }

    const frameStyle = { width, height, backgroundColor: '#000000' };

    const videoSource = (uri: string, rawUrl?: string) => {
        // Demo MP4s: pass bundled require — URI from resolveAssetSource often fails on device.
        if (rawUrl && isMockDemoVideoPath(rawUrl)) {
            return mockFeedVideoSource(rawUrl);
        }
        if (isMockDemoVideoPath(uri)) {
            return mockFeedVideoSource(uri);
        }
        const lower = uri.toLowerCase();
        if (lower.includes('.m3u8')) return { uri, type: 'm3u8' as const };
        if (lower.includes('.webm')) return { uri, type: 'webm' as const };
        return { uri };
    };

    const setFeedSoundOn = (nextSoundOn: boolean) => {
        setSoundOn(nextSoundOn);
        void setGlobalVideoMutedNative(!nextSoundOn);
    };

    const onVideoError = (rawUrl: string, error?: unknown) => {
        const played = getPlaybackUrl(rawUrl);
        if (
            !videoUrlFallbackByRaw[rawUrl] &&
            played !== MOCK_FEED_VIDEO_REMOTE_FALLBACK &&
            (rawUrl.includes('/demo-videos/') || rawUrl.startsWith('/'))
        ) {
            setVideoUrlFallbackByRaw((prev) => ({
                ...prev,
                [rawUrl]: MOCK_FEED_VIDEO_REMOTE_FALLBACK,
            }));
            setPlayFailed(false);
            beginUrlLoad(rawUrl);
            return;
        }
        console.warn('Video playback failed:', played, error);
        setPlayFailed(true);
        markUrlLoaded(rawUrl);
    };

    const retryVideoPlayback = () => {
        setPlayFailed(false);
        if (mediaUrl) beginUrlLoad(mediaUrl);
    };

    const showVideoPlayFailed = video && playFailed && mode === 'feed';

    const renderSlide = (
        item: (typeof carouselItems)[number],
        slideIndex: number,
    ) => {
        const slideRawUrl = item?.url || post.mediaUrl;
        if (!slideRawUrl) return <View style={frameStyle} />;

        const slideUrl = getPlaybackUrl(slideRawUrl);
        const slideIsVideo = item?.type === 'video' || (!item && isVideoPost(post));
        const slideVideo = !textOnly && slideIsVideo;
        const slideFeedPlay =
            mode === 'feed' && slideVideo && isActive && slideIndex === currentIndex && !playFailed;
        const showLoader =
            !slideVideo && !!loadingByUrl[slideRawUrl] && !loadedUrlsRef.current.has(slideRawUrl);

        const slidePoster =
            (item as { posterUrl?: string } | undefined)?.posterUrl || postLevelPoster;

        const slideUseNativePlayer =
            mode === 'detail' || (mode === 'feed' && feedVideoReady && slideVideo);

        const slideInner = slideVideo ? (
            slideUseNativePlayer ? (
                <Video
                    ref={
                        mode === 'feed' && slideVideo && slideIndex === currentIndex
                            ? feedVideoRef
                            : undefined
                    }
                    source={videoSource(slideUrl, slideRawUrl)}
                    style={frameStyle}
                    resizeMode={mode === 'detail' ? 'contain' : 'cover'}
                    controls={mode === 'detail'}
                    paused={mode === 'detail' ? paused : !slideFeedPlay}
                    muted={mode === 'feed' ? !soundOn : undefined}
                    repeat={mode === 'feed'}
                    poster={slidePoster}
                    posterResizeMode="cover"
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="ignore"
                    pointerEvents={mediaPointerEvents}
                    {...feedVideoSurfaceProps}
                    onLoad={() => markUrlLoaded(slideRawUrl)}
                    onProgress={
                        slideFeedPlay
                            ? (e) => onFeedVideoProgress(e.currentTime)
                            : undefined
                    }
                    onError={(e) => onVideoError(slideRawUrl, e)}
                />
            ) : slidePoster ? (
                <Image
                    source={{ uri: slidePoster }}
                    style={frameStyle}
                    resizeMode="cover"
                    resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                    pointerEvents={mediaPointerEvents}
                    onLoad={() => markUrlLoaded(slideRawUrl)}
                    onError={() => markUrlLoaded(slideRawUrl)}
                />
            ) : (
                <View style={[frameStyle, styles.videoFallback]}>
                    {showLoader ? <ActivityIndicator color="#f472b6" /> : null}
                    <Icon name="videocam-outline" size={36} color="#6B7280" />
                </View>
            )
        ) : (
            <Image
                source={{ uri: slideUrl }}
                style={frameStyle}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                progressiveRenderingEnabled={false}
                pointerEvents={mediaPointerEvents}
                onLoadStart={() => beginUrlLoad(slideRawUrl)}
                onLoad={() => markUrlLoaded(slideRawUrl)}
                onError={() => markUrlLoaded(slideRawUrl)}
            />
        );

        return (
            <View style={frameStyle} collapsable={false}>
                <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
                    {slideInner}
                </View>
                {showLoader ? (
                    <View style={styles.loadingOverlay} pointerEvents="none">
                        <ActivityIndicator color="#f472b6" />
                    </View>
                ) : null}
                {renderFeedTapOverlay()}
            </View>
        );
    };

    const primarySlideItem =
        activeItem ??
        (mediaUrl
            ? {
                  url: mediaUrl,
                  type: (isVideoPost(post) ? 'video' : 'image') as 'video' | 'image',
              }
            : undefined);

    const inner = hasCarousel ? null : primarySlideItem ? renderSlide(primarySlideItem, 0) : null;

    const mediaBody = (
        <>
            {hasCarousel ? (
                <ScrollView
                    ref={carouselScrollRef}
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={onCarouselScrollEnd}
                    style={{ width, height }}
                >
                    {carouselItems.map((item, index) => (
                        <View key={`${post.id}-carousel-${index}-${item.url}`} style={{ width, height }}>
                            {renderSlide(item, index)}
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={{ width, height }}>
                    {inner}
                    {mediaUrl && loadingByUrl[mediaUrl] && !loadedUrlsRef.current.has(mediaUrl) && !video ? (
                        <View style={styles.loadingOverlay} pointerEvents="none">
                            <ActivityIndicator color="#f472b6" />
                        </View>
                    ) : null}
                </View>
            )}
        </>
    );

    return (
        <View style={[styles.wrap, { width, height }, style]} collapsable={false}>
            {feedTapCapture && hasCarousel ? (
                <GestureDetector gesture={mediaTapGesture}>
                    <View style={{ width, height }} collapsable={false}>
                        {mediaBody}
                    </View>
                </GestureDetector>
            ) : (
                mediaBody
            )}
            {video ? <FeedVideoCaptionOverlay post={post} /> : null}
            {imageText ? (
                <View style={styles.imageTextOverlay} pointerEvents="none">
                    <Text style={styles.imageText}>{imageText}</Text>
                </View>
            ) : null}
            {stickers && stickers.length > 0 ? (
                <FeedStickerOverlays
                    stickers={stickers}
                    containerWidth={width}
                    containerHeight={height}
                />
            ) : null}
            {video && mode === 'feed' && !feedShouldPlay && !playFailed ? (
                <View style={styles.videoTypeBadge} pointerEvents="none">
                    <Icon name="videocam" size={12} color="#FFFFFF" />
                    <Text style={styles.videoTypeBadgeText}>VIDEO</Text>
                </View>
            ) : null}
            {renderFeedTapOverlay()}
            {showScenesCta ? (
                <VideoCTAOverlay onPress={handleOpenScenesPress} userHandle={post.userHandle} />
            ) : null}
            {showMuteButton ? (
                <Pressable
                    style={styles.muteButton}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        setFeedSoundOn(!soundOn);
                        setMuteFlash(true);
                        setTimeout(() => setMuteFlash(false), 1100);
                    }}
                    hitSlop={8}
                >
                    <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={20} color="#FFFFFF" />
                </Pressable>
            ) : null}
            {video && mode === 'detail' && paused ? (
                <Pressable style={styles.playBadge} onPress={() => setPaused(false)}>
                    <Icon name="play-circle" size={64} color="rgba(255,255,255,0.95)" />
                </Pressable>
            ) : null}
            {showVideoPlayFailed ? (
                <Pressable style={styles.videoErrorOverlay} onPress={retryVideoPlayback}>
                    <Icon name="refresh-circle" size={32} color="#FFFFFF" />
                    <Text style={styles.videoErrorTitle}>Video could not play</Text>
                    <Text style={styles.videoErrorHint}>Tap to retry</Text>
                </Pressable>
            ) : null}
            {burstAt ? (
                <View style={styles.burstLayer} pointerEvents="none">
                    <FeedDoubleTapLikeBurst key={burstKey} x={burstAt.x} y={burstAt.y} />
                </View>
            ) : null}
        </View>
    );
});

export default FeedPostMedia;

const styles = StyleSheet.create({
    wrap: {
        overflow: 'hidden',
        backgroundColor: '#000000',
        position: 'relative',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    playBadge: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    muteButton: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 25,
        elevation: Platform.OS === 'android' ? 25 : 0,
    },
    videoFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textOnlyCard: {
        borderRadius: 16,
        padding: 18,
        minHeight: 120,
        justifyContent: 'center',
    },
    textOnlyBody: {
        fontWeight: '600',
        lineHeight: 22,
    },
    imageTextOverlay: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 3,
    },
    imageText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.85)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    videoTypeBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 5,
    },
    videoTypeBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    videoErrorOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 16,
        zIndex: 14,
    },
    burstLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        elevation: Platform.OS === 'android' ? 50 : 0,
    },
    videoErrorTitle: {
        marginTop: 8,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    videoErrorHint: {
        marginTop: 4,
        color: '#D1D5DB',
        fontSize: 12,
        textAlign: 'center',
    },
});
