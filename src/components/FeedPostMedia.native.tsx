import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    Animated,
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
import type { Post, PostMediaItem, StickerOverlay } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import {
    getActiveFeedVideoPostId,
    subscribeActiveFeedVideo,
} from '../utils/feedActiveVideoNative';
import { consumeFeedVideoHandoff, setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import { withFeedVideoCache } from '../utils/feedVideoSourceNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia, resolvePostPlaybackUri } from '../utils/postMedia';
import {
    feedAspectRatio,
    intrinsicRatio,
    resolveIntrinsicSize,
    RATIO_FALLBACK,
} from '../utils/mediaAspectRatio';
import {
    MOCK_FEED_VIDEO_REMOTE_FALLBACK,
    isMockDemoVideoPath,
    isPlayableLocalMediaUri,
    mockFeedVideoSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import { FEED_CARD_MEDIA_TAP_LAYER } from './FeedPageLayout.native';
import VideoCTAOverlay from './VideoCTAOverlay.native';
import FeedVideoCaptionOverlay from './FeedVideoCaptionOverlay.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';

function firstMediaUri(...vals: unknown[]): string | undefined {
    for (const v of vals) {
        if (typeof v === 'string' && v.trim() && !/^data:text\//i.test(v.trim())) {
            return v.trim();
        }
    }
    return undefined;
}

/** Same URI → same source object so like re-renders don't reload the MP4. */
const FEED_VIDEO_SOURCE_CACHE = new Map<string, object>();

function buildFeedVideoSource(uri: string, rawUrl?: string): object {
    const sourceUri = uri || rawUrl || '';
    const cacheKey = `${rawUrl || ''}|${sourceUri}`;
    const cached = FEED_VIDEO_SOURCE_CACHE.get(cacheKey);
    if (cached) return cached;

    let source: object;
    if (isPlayableLocalMediaUri(rawUrl) || isPlayableLocalMediaUri(uri)) {
        source = { uri: rawUrl && isPlayableLocalMediaUri(rawUrl) ? rawUrl : uri };
    } else if (rawUrl && isMockDemoVideoPath(rawUrl)) {
        source = mockFeedVideoSource(rawUrl) as object;
    } else if (isMockDemoVideoPath(uri)) {
        source = mockFeedVideoSource(uri) as object;
    } else {
        const lower = sourceUri.toLowerCase();
        if (lower.includes('.m3u8')) {
            source = withFeedVideoCache({ uri: sourceUri, type: 'm3u8' as const });
        } else if (lower.includes('.webm')) {
            source = withFeedVideoCache({ uri: sourceUri, type: 'webm' as const });
        } else {
            source = withFeedVideoCache({ uri: sourceUri });
        }
    }
    FEED_VIDEO_SOURCE_CACHE.set(cacheKey, source);
    return source;
}

function resolveFeedVideoPosterUri(
    item: PostMediaItem | undefined,
    post: Post,
): string | undefined {
    const extra = item as { thumbnailUrl?: string; thumbnail_url?: string } | undefined;
    const postExtra = post as { thumbnailUrl?: string; thumbnail_url?: string };
    return firstMediaUri(
        extra?.posterUrl,
        extra?.thumbnailUrl,
        extra?.thumbnail_url,
        post.videoPosterUrl,
        postExtra.thumbnailUrl,
        postExtra.thumbnail_url,
    );
}

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
    /**
     * Fired once the intrinsic pixel size of the current slide is known -- from the
     * backend payload when present, otherwise from `naturalSize`/`source` at load time.
     * The card wrapper uses it to size itself to the content instead of a fixed token
     * height, which is what removes the letterbox.
     *
     * Reports the RAW intrinsic width/height, not the clamped feed ratio: the wrapper
     * needs to know what the media actually is before deciding how to clamp it.
     * Not fired for text-only posts.
     */
    onIntrinsicSize?: (size: { width: number; height: number }) => void;
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
    /**
     * Android: unmount the native Video surface (e.g. while comments sheet is open).
     * Paused TextureViews still punch through Modals on some OEMs.
     */
    suspendNativeVideo?: boolean;
    /** Feed autoplay is muted by default (global mute pref). */
    muted?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Feed video: opens vertical Scenes viewer. */
    onOpenScenes?: () => void;
};

const FeedPostMedia = React.memo(
    React.forwardRef<FeedPostMediaHandle, Props>(function FeedPostMedia(
    {
        post,
        carouselIndex = 0,
        onCarouselIndexChange,
        width,
        height,
        onIntrinsicSize,
        onPress,
        onDoubleLike,
        onSingleTap,
        stickers,
        onMediaLoad,
        mode = 'feed',
        isActive = false,
        suspendNativeVideo = false,
        muted = true,
        style,
        onOpenScenes,
    },
    ref,
) {
    const [loadingByUrl, setLoadingByUrl] = useState<Record<string, boolean>>({});
    const [paused, setPaused] = useState(mode === 'feed');
    const [playFailed, setPlayFailed] = useState(false);
    const pendingSeekRef = useRef<number | null>(null);
    const playbackTimeRef = useRef(0);
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
    /** First decoded frame ready — crossfade video in / poster out. */
    const [videoSurfaceReady, setVideoSurfaceReady] = useState(false);
    const [posterMounted, setPosterMounted] = useState(true);
    const posterOpacity = useRef(new Animated.Value(1)).current;
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const mediaRevealRef = useRef<Animated.CompositeAnimation | null>(null);
    /** Feed autoplay target from FlatList viewability (store). */
    const [storeActivePostId, setStoreActivePostId] = useState<string | null>(() =>
        getActiveFeedVideoPostId(),
    );
    /**
     * Intrinsic width/height measured at runtime, from RNV `naturalSize` (video) or
     * `source` (image). Null until the first load. This replaces the old
     * `isLandscapeMedia` boolean: that flag could only choose between 4:5 and 16:9, so
     * a 9:16 clip and a 4:3 clip were indistinguishable and both got the wrong box.
     */
    const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(
        null,
    );

    const resetPosterCover = useCallback(() => {
        mediaRevealRef.current?.stop();
        mediaRevealRef.current = null;
        posterOpacity.setValue(1);
        videoOpacity.setValue(0);
        setVideoSurfaceReady(false);
        setPosterMounted(true);
    }, [posterOpacity, videoOpacity]);

    const fadeOutPosterCover = useCallback(() => {
        setVideoSurfaceReady((prev) => {
            if (prev) return prev;
            mediaRevealRef.current?.stop();
            mediaRevealRef.current = Animated.parallel([
                Animated.timing(videoOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(posterOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]);
            mediaRevealRef.current.start(({ finished }) => {
                if (finished) setPosterMounted(false);
                mediaRevealRef.current = null;
            });
            return true;
        });
    }, [posterOpacity, videoOpacity]);

    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeActiveFeedVideo(setStoreActivePostId);
    }, [mode]);

    const isViewable =
        mode === 'feed' &&
        !suspendNativeVideo &&
        String(storeActivePostId) === String(post.id);
    const isFeedAutoplayActive = isViewable;

    // Bumped when overlay suspend ends while this card is active — forces TextureView remount.
    const [playerEpoch, setPlayerEpoch] = useState(0);
    const needsRemountAfterSuspendRef = useRef(false);

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

    /** Backend-supplied dimensions for the current slide, if the API provided them. */
    const apiSize = React.useMemo(() => {
        const item = carouselItems[currentIndex];
        const w = Number(item?.width ?? post.width);
        const h = Number(item?.height ?? post.height);

        return intrinsicRatio(w, h) != null ? { width: w, height: h } : null;
    }, [carouselItems, currentIndex, post.width, post.height]);

    /**
     * Resolved through the SAME helper the card wrapper uses. These two layers are each
     * given the other's height and then re-derive one, so any disagreement between them
     * surfaces immediately as black space between the video and the engagement row. Routing
     * both through `resolveIntrinsicSize` makes that divergence impossible by construction.
     *
     * Declared here, above the reporting effect, because that effect needs it on the very
     * first render -- that first paint is exactly when a wrong box is most visible.
     */
    const effectiveSize = resolveIntrinsicSize({
        api: apiSize,
        measured: measuredSize,
        measuredForId: post.id,
        postId: post.id,
    });

    const reportIntrinsicSize = useCallback(
        (size: { width: number; height: number }) => {
            onIntrinsicSize?.(size);
        },
        [onIntrinsicSize],
    );

    /**
     * Once we know what the media is, tell the wrapper. An effect rather than firing
     * from the load handler directly so the API dimensions also reach the parent on the
     * very first render -- that is the whole point of storing them, and it removes the
     * layout shift a late `onLoad` would otherwise cause.
     */
    React.useEffect(() => {
        if (effectiveSize) {
            reportIntrinsicSize(effectiveSize);
        }
        // `effectiveSize` is a fresh object each render, so depend on its contents instead.
    }, [effectiveSize?.width, effectiveSize?.height, reportIntrinsicSize]);

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
        setMeasuredSize(null);
    }, [post.id]);

    // Prefetch video posters so placeholders paint instantly on re-scroll.
    useEffect(() => {
        const uris = new Set<string>();
        const rootPoster = resolveFeedVideoPosterUri(undefined, post);
        if (rootPoster) uris.add(rootPoster);
        for (const item of post.mediaItems || []) {
            const poster = resolveFeedVideoPosterUri(item, post);
            if (poster && /^https?:\/\//i.test(poster)) {
                uris.add(poster);
            } else if (poster && isPlayableLocalMediaUri(poster)) {
                uris.add(poster);
            }
        }
        for (const uri of uris) {
            if (/^https?:\/\//i.test(uri)) {
                void Image.prefetch(uri).catch(() => {});
            }
        }
    }, [post.id, post.mediaItems, post.videoPosterUrl]);

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
    const rawMediaUrl = resolvePostPlaybackUri(post, activeItem);
    const getPlaybackUrl = (raw: string) => {
        if (videoUrlFallbackByRaw[raw]) return videoUrlFallbackByRaw[raw];
        // Device uploads / temp storage — never run through demo remapping.
        if (isPlayableLocalMediaUri(raw)) return raw;
        if (/^https?:\/\//i.test(raw) && !isMockDemoVideoPath(raw)) return raw;
        return resolveMockFeedVideoUrl(raw);
    };
    const mediaUrl = rawMediaUrl;
    const activeIsVideo = activeItem?.type === 'video' || (!activeItem && isVideoPost(post));
    const activeIsImage = !activeIsVideo && !!mediaUrl;
    const imageText =
        activeIsImage && post.imageText ? String(post.imageText).trim() : '';

    const textOnly = isTextOnlyPost(post);
    const video = !textOnly && activeIsVideo && !!mediaUrl;
    const showScenesCta =
        mode === 'feed' && video && postHasVideoMedia(post) && Boolean(onOpenScenes);
    const showMuteButton = video && mode === 'feed' && isFeedAutoplayActive;

    useEffect(() => {
        if (suspendNativeVideo) {
            needsRemountAfterSuspendRef.current = true;
        }
    }, [suspendNativeVideo]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        if (!isFeedAutoplayActive || suspendNativeVideo) return;
        if (!needsRemountAfterSuspendRef.current) return;
        needsRemountAfterSuspendRef.current = false;
        setPlayerEpoch((n) => n + 1);
        resetPosterCover();
        setPaused(false);
        setPlayFailed(false);
    }, [isFeedAutoplayActive, mode, resetPosterCover, suspendNativeVideo, video]);

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
        if (mode !== 'detail' || !video) return;
        setPaused(false);
        setPlayFailed(false);
        if (mediaUrl) beginUrlLoad(mediaUrl);
    }, [beginUrlLoad, mediaUrl, mode, post.id, video]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        setPlayFailed(false);
        if (mediaUrl) beginUrlLoad(mediaUrl);
    }, [mediaUrl, mode, video, beginUrlLoad]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        if (isFeedAutoplayActive && !suspendNativeVideo) {
            // Resume in place — do not cover/seek to 0 (double-tap like re-renders the card).
            setPaused(false);
            setPlayFailed(false);
            const handoff = consumeFeedVideoHandoff(String(post.id));
            const resumeAt =
                handoff && Number.isFinite(handoff.currentTime) && handoff.currentTime > 0.05
                    ? handoff.currentTime
                    : playbackTimeRef.current > 0.05
                      ? playbackTimeRef.current
                      : null;
            if (resumeAt != null) {
                pendingSeekRef.current = resumeAt;
            }
            return;
        }

        // Pause only. Seek to 0 only when a *different* post became active
        // (scroll away). Overlays / like burst must not restart this clip.
        setPaused(true);
        const stillThisPost = String(storeActivePostId) === String(post.id);
        const player = feedVideoRef.current as
            | (VideoRef & { pause?: () => void; seek?: (t: number) => void })
            | null;
        try {
            player?.pause?.();
            if (!stillThisPost) {
                pendingSeekRef.current = null;
                playbackTimeRef.current = 0;
                resetPosterCover();
                player?.seek?.(0);
            }
        } catch {
            /* ignore */
        }
    }, [
        isFeedAutoplayActive,
        mode,
        post.id,
        resetPosterCover,
        storeActivePostId,
        suspendNativeVideo,
        video,
    ]);

    // Unmount / remount safety — always stop ExoPlayer audio.
    useEffect(() => {
        return () => {
            const player = feedVideoRef.current as
                | (VideoRef & { pause?: () => void })
                | null;
            try {
                player?.pause?.();
            } catch {
                /* ignore */
            }
        };
    }, []);

    useEffect(() => {
        resetPosterCover();
    }, [mediaUrl, currentIndex, post.id, resetPosterCover]);

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

    const lastDoubleTapAtRef = useRef(0);

    const handleFullscreen = useCallback(() => {
        if (Date.now() - lastDoubleTapAtRef.current < 500) return;
        if (onPress && !onDoubleLike && !onSingleTap) {
            onPress();
            return;
        }
        onSingleTap?.();
    }, [onDoubleLike, onPress, onSingleTap]);

    const handleLikeAt = useCallback(
        (x: number, y: number) => {
            lastDoubleTapAtRef.current = Date.now();
            const localX = Number.isFinite(x) ? x : width / 2;
            const insetTop =
                !hasCarousel && typeof FEED_CARD_MEDIA_TAP_LAYER.top === 'number'
                    ? FEED_CARD_MEDIA_TAP_LAYER.top
                    : 0;
            const localY = Number.isFinite(y) ? y + insetTop : height / 2;
            fireBurstAt(localX, localY);
            onDoubleLike?.(localX, localY);
        },
        [fireBurstAt, hasCarousel, height, onDoubleLike, width],
    );

    const mediaTapGesture = useMemo(() => {
        const doubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(400)
            .maxDelay(300)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleLikeAt)(e.x, e.y);
            });
        const singleTap = Gesture.Tap()
            .numberOfTaps(1)
            .maxDuration(250)
            .onEnd((_e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleFullscreen)();
            });
        singleTap.requireExternalGestureToFail(doubleTap);
        const exclusive = Gesture.Exclusive(doubleTap, singleTap);
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

    const setFeedSoundOn = (nextSoundOn: boolean) => {
        setSoundOn(nextSoundOn);
        void setGlobalVideoMutedNative(!nextSoundOn);
    };

    const onVideoError = (rawUrl: string, error?: unknown) => {
        const played = getPlaybackUrl(rawUrl);
        // Only demo slot paths may fall back to the shared sample clip.
        if (
            !videoUrlFallbackByRaw[rawUrl] &&
            played !== MOCK_FEED_VIDEO_REMOTE_FALLBACK &&
            !isPlayableLocalMediaUri(rawUrl) &&
            (rawUrl.includes('/demo-videos/') || isMockDemoVideoPath(rawUrl))
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

    /**
     * The ratio we actually render at: content-first, clamped only at the policy
     * extremes. `height` is now a MAXIMUM rather than a fixed box -- the wrapper may have
     * measured a different (content-derived) height and passes that down, but a caller
     * that still passes a token height gets a sane clamp instead of an unstretched box.
     */    const intrinsicWidth = effectiveSize?.width;
    const intrinsicHeight = effectiveSize?.height;
    const targetRatio = feedAspectRatio(intrinsicWidth, intrinsicHeight);
    const contentHeight =
        width > 0 ? Math.round(width / targetRatio) : height > 0 ? height : 0;
    // Clamp to the height the wrapper actually allocated so the video can never overflow the
    // card. This can never open a gap: when the wrapper was capped below the content height,
    // `height` IS the wrapper's height, so the frame lands exactly on it and the engagement
    // row stays flush. The visible effect of capping is extra cropping via resizeMode="cover",
    // which is the intended trade for a very tall clip on a short viewport.
    //
    // Deliberately NOT also clamped to `width`: any portrait ratio is below 1, so
    // width/ratio exceeds width, and bounding by width would shrink the frame below the
    // wrapper and reintroduce the very black gap this clamp is meant to prevent.
    const frameHeight = height > 0 ? Math.min(contentHeight, height) : contentHeight;
    const mediaAspect = width > 0 && frameHeight > 0 ? width / frameHeight : RATIO_FALLBACK;
    const frameStyle = {
        width,
        height: frameHeight,
        aspectRatio: mediaAspect,
        backgroundColor: '#121212',
        overflow: 'hidden' as const,
    };

    const renderSlide = (
        item: (typeof carouselItems)[number],
        slideIndex: number,
    ) => {
        const slideRawUrl = resolvePostPlaybackUri(post, item) || item?.url || post.mediaUrl;
        if (!slideRawUrl) {
            return <View style={[styles.mediaFrame, frameStyle]} collapsable={false} />;
        }

        const slideUrl = getPlaybackUrl(slideRawUrl);
        const slideIsVideo = item?.type === 'video' || (!item && isVideoPost(post));
        const slideVideo = !textOnly && slideIsVideo;

        const slidePosterRaw = resolveFeedVideoPosterUri(
            item as PostMediaItem | undefined,
            post,
        );
        const slidePosterUri = slidePosterRaw;

        const slideIsCurrent = slideIndex === currentIndex;
        // Keep the player mounted (paused) while the cell is on-screen so the
        // first frame / poster is ready before autoplay. Unmount only for
        // overlay suspend (Android TextureView punch-through) or play failure.
        const slideMountVideo =
            slideVideo &&
            slideIsCurrent &&
            !playFailed &&
            (mode === 'detail' || (mode === 'feed' && !suspendNativeVideo));

        // Still images: never gated by video readiness — always fully opaque.
        if (!slideVideo) {
            return (
                <View style={[styles.mediaFrame, frameStyle]} collapsable={false}>
                    <Image
                        source={{ uri: slideUrl }}
                        style={[styles.stillImage, { width: '100%', height: '100%' }]}
                        resizeMode="cover"
                        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                        progressiveRenderingEnabled={false}
                        pointerEvents={mediaPointerEvents}
                        onLoadStart={() => beginUrlLoad(slideRawUrl)}
                        onLoad={(e) => {
                            markUrlLoaded(slideRawUrl);
                            if (!slideIsCurrent) return;
                            const src = e.nativeEvent.source;
                            if (src && intrinsicRatio(src.width, src.height) != null) {
                                setMeasuredSize({
                                    width: Number(src.width),
                                    height: Number(src.height),
                                });
                            }
                        }}
                        onError={() => markUrlLoaded(slideRawUrl)}
                    />
                    {renderFeedTapOverlay()}
                </View>
            );
        }

        // Poster stays fully visible until first decoded frame — covers buffer/black frames.
        const showBufferCover = !slideMountVideo || posterMounted || !videoSurfaceReady;
        const onFirstFrameReady = () => {
            markUrlLoaded(slideRawUrl);
            fadeOutPosterCover();
        };
        const cachedVideoSource = buildFeedVideoSource(slideUrl, slideRawUrl);

        return (
            <View style={[styles.mediaFrame, frameStyle]} collapsable={false}>
                {slideMountVideo ? (
                    <View
                        style={[
                            styles.videoClip,
                            { width, height: frameHeight },
                        ]}
                        pointerEvents={mediaPointerEvents}
                        collapsable={false}
                    >
                        <Video
                            key={`video-${post.id}-${slideIndex}-${slideRawUrl}-${playerEpoch}`}
                            ref={feedVideoRef}
                            source={cachedVideoSource as object}
                            style={{ width, height: frameHeight }}
                            resizeMode="cover"
                            controls={false}
                            paused={mode === 'detail' ? paused : !isViewable}
                            muted={mode === 'feed' ? !soundOn : false}
                            volume={mode === 'detail' ? 1 : soundOn ? 1 : 0}
                            repeat={mode === 'feed'}
                            playInBackground={false}
                            playWhenInactive={false}
                            ignoreSilentSwitch="ignore"
                            useTextureView
                            hideShutterView
                            poster={
                                slidePosterUri
                                    ? {
                                          source: { uri: slidePosterUri },
                                          resizeMode: 'cover' as const,
                                      }
                                    : undefined
                            }
                            {...androidListSafeVideoProps()}
                            pointerEvents="none"
                            onLoadStart={() => {
                                beginUrlLoad(slideRawUrl);
                            }}
                            onReadyForDisplay={onFirstFrameReady}
                            onLoad={(meta) => {
                                onFirstFrameReady();
                                const seekTo =
                                    pendingSeekRef.current ??
                                    (playbackTimeRef.current > 0.05 ? playbackTimeRef.current : null);
                                if (
                                    seekTo != null &&
                                    Number.isFinite(seekTo) &&
                                    seekTo > 0.05 &&
                                    feedVideoRef.current
                                ) {
                                    pendingSeekRef.current = null;
                                    try {
                                        feedVideoRef.current.seek(seekTo);
                                    } catch {
                                        /* ignore */
                                    }
                                }
                                // Intrinsic dimensions straight from the container
                                // metadata. `naturalSize` is the pre-rotation size; a clip
                                // recorded at 1920x1080 then rotated to portrait reports
                                // width < height, which is exactly what we want to size to.
                                const ns = meta?.naturalSize;
                                if (ns && intrinsicRatio(ns.width, ns.height) != null) {
                                    setMeasuredSize({
                                        width: Number(ns.width),
                                        height: Number(ns.height),
                                    });
                                }
                            }}
                            onProgress={(e) => {
                                const t = e?.currentTime;
                                if (typeof t === 'number' && Number.isFinite(t)) {
                                    playbackTimeRef.current = t;
                                }
                                if (mode !== 'feed' || !isFeedAutoplayActive) return;
                                if (typeof t === 'number' && Number.isFinite(t)) {
                                    setFeedVideoHandoff(String(post.id), {
                                        currentTime: t,
                                        muted: !soundOn,
                                        mediaUrl: slideRawUrl,
                                    });
                                }
                            }}
                            onError={(e) => onVideoError(slideRawUrl, e)}
                        />
                    </View>
                ) : null}

                {slidePosterUri && showBufferCover ? (
                    <Animated.Image
                        source={{ uri: slidePosterUri }}
                        style={[
                            styles.posterCover,
                            { opacity: slideMountVideo ? posterOpacity : 1 },
                        ]}
                        resizeMode="cover"
                        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                        pointerEvents="none"
                        onLoad={() => markUrlLoaded(slideRawUrl)}
                        onError={() => markUrlLoaded(slideRawUrl)}
                    />
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
                    style={{ width, height: frameHeight, aspectRatio: mediaAspect }}
                >
                    {carouselItems.map((item, index) => (
                        <View
                            key={`${post.id}-carousel-${index}-${item.url}`}
                            style={[styles.mediaFrame, { width, height: frameHeight, aspectRatio: mediaAspect }]}
                        >
                            {renderSlide(item, index)}
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={[styles.mediaFrame, { width, height: frameHeight, aspectRatio: mediaAspect }]}>
                    {inner}
                </View>
            )}
        </>
    );

    return (
        <View
            style={[
                styles.wrap,
                styles.mediaFrame,
                { width, height: frameHeight, aspectRatio: mediaAspect },
                style,
            ]}
            collapsable={false}
        >
            {feedTapCapture && hasCarousel ? (
                <GestureDetector gesture={mediaTapGesture}>
                    <View
                        style={[styles.mediaFrame, { width, height: frameHeight, aspectRatio: mediaAspect }]}
                        collapsable={false}
                    >
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
                    containerHeight={frameHeight}
                />
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
                    <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={14} color="#FFFFFF" />
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
    }),
    function feedPostMediaPropsAreEqual(prev: Props, next: Props) {
        const a = prev.post;
        const b = next.post;
        return (
            a.id === b.id &&
            a.mediaUrl === b.mediaUrl &&
            a.finalVideoUrl === b.finalVideoUrl &&
            a.mediaType === b.mediaType &&
            a.videoPosterUrl === b.videoPosterUrl &&
            a.thumbnailUrl === b.thumbnailUrl &&
            prev.width === next.width &&
            prev.height === next.height &&
            prev.mode === next.mode &&
            prev.muted === next.muted &&
            prev.suspendNativeVideo === next.suspendNativeVideo &&
            prev.carouselIndex === next.carouselIndex &&
            JSON.stringify(a.mediaItems) === JSON.stringify(b.mediaItems)
        );
    },
);

export default FeedPostMedia;

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
        overflow: 'hidden',
    },
    mediaFrame: {
        overflow: 'hidden',
        backgroundColor: '#121212',
        position: 'relative',
        borderRadius: 1,
    },
    videoClip: {
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 1,
        backgroundColor: '#121212',
    },
    stillImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        opacity: 1,
    },
    /** Explicit fill — Android TextureView collapses to 0×0 without width/height. */
    videoFill: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    /** Sits above Video until first frame, then faded/unmounted. */
    posterCover: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        zIndex: 2,
        elevation: Platform.OS === 'android' ? 2 : 0,
    },
    posterPlaceholder: {
        backgroundColor: '#121212',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        zIndex: 6,
    },
    playBadge: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    muteButton: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 25,
        elevation: Platform.OS === 'android' ? 25 : 0,
    },
    videoFallback: {
        backgroundColor: '#121212',
    },
    mediaFill: {
        ...StyleSheet.absoluteFillObject,
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
    videoErrorOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 16,
        zIndex: 14,
    },
    burstLayer: {
        ...StyleSheet.absoluteFill,
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
