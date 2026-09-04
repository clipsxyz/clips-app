import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
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
import { FlatList, Gesture, GestureDetector, Pressable as GesturePressable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Post, PostMediaItem, StickerOverlay } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import {
    getActiveFeedVideoPostId,
    subscribeActiveFeedVideo,
} from '../utils/feedActiveVideoNative';
import { consumeFeedVideoHandoff, peekFeedVideoHandoff, setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import { withFeedVideoCache } from '../utils/feedVideoSourceNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyLineHeight,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia, resolvePostPlaybackUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import {
    MOCK_FEED_VIDEO_REMOTE_FALLBACK,
    isMockDemoVideoPath,
    isPlayableLocalMediaUri,
    mockFeedVideoSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import VideoCTAOverlay from './VideoCTAOverlay.native';
import FeedVideoCaptionOverlay from './FeedVideoCaptionOverlay.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';

const ANDROID_FEED_VIDEO_PROPS = androidListSafeVideoProps();
const DOUBLE_TAP_MS = 320;

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

type FeedPlayingVideoProps = {
    remountEpoch: number;
    source: object;
    paused: boolean;
    muted: boolean;
    volume: number;
    repeat: boolean;
    posterUri?: string;
    pointerEvents?: 'none';
    videoRef: React.Ref<VideoRef>;
    onLoadStart: () => void;
    onReady: () => void;
    onLoad: (meta: { naturalSize?: { width?: number; height?: number } }) => void;
    onProgress: (e: { currentTime?: number }) => void;
    onError: (e: unknown) => void;
    resizeMode?: 'cover' | 'contain';
    /** Pixel box — ColorOS TextureView ignores % / overflow and paints into the next slide. */
    boxWidth: number;
    boxHeight: number;
};

/** Isolated so like-burst setState on the card does not rebuild ExoPlayer. */
const FeedPlayingVideo = React.memo(function FeedPlayingVideo({
    remountEpoch,
    source,
    paused,
    muted,
    volume,
    repeat,
    posterUri,
    pointerEvents,
    videoRef,
    onLoadStart,
    onReady,
    onLoad,
    onProgress,
    onError,
    resizeMode = 'cover',
    boxWidth,
    boxHeight,
}: FeedPlayingVideoProps) {
    const onLoadStartRef = useRef(onLoadStart);
    const onReadyRef = useRef(onReady);
    const onLoadRef = useRef(onLoad);
    const onProgressRef = useRef(onProgress);
    const onErrorRef = useRef(onError);
    onLoadStartRef.current = onLoadStart;
    onReadyRef.current = onReady;
    onLoadRef.current = onLoad;
    onProgressRef.current = onProgress;
    onErrorRef.current = onError;

    const poster = useMemo(
        () =>
            posterUri
                ? { source: { uri: posterUri }, resizeMode: 'cover' as const }
                : undefined,
        [posterUri],
    );

    const videoBox = {
        width: boxWidth,
        height: boxHeight,
        overflow: 'hidden' as const,
    };

    return (
        <View style={videoBox} pointerEvents={pointerEvents} collapsable={false}>
            <Video
                key={`feed-exo-${remountEpoch}`}
                ref={videoRef}
                source={source}
                style={videoBox}
                resizeMode={resizeMode}
                controls={false}
                paused={paused}
                muted={muted}
                volume={volume}
                repeat={repeat}
                playInBackground={false}
                ignoreSilentSwitch="ignore"
                useTextureView
                hideShutterView
                poster={poster}
                {...ANDROID_FEED_VIDEO_PROPS}
                playWhenInactive
                pointerEvents="none"
                onLoadStart={() => onLoadStartRef.current()}
                onReadyForDisplay={() => onReadyRef.current()}
                onLoad={(meta) => onLoadRef.current(meta)}
                onProgress={(e) => onProgressRef.current(e)}
                onError={(e) => onErrorRef.current(e)}
            />
        </View>
    );
}, (prev, next) => (
    prev.remountEpoch === next.remountEpoch &&
    prev.source === next.source &&
    prev.paused === next.paused &&
    prev.muted === next.muted &&
    prev.volume === next.volume &&
    prev.repeat === next.repeat &&
    prev.posterUri === next.posterUri &&
    prev.resizeMode === next.resizeMode &&
    prev.boxWidth === next.boxWidth &&
    prev.boxHeight === next.boxHeight
));

function resolveFeedVideoPosterUri(
    item: PostMediaItem | undefined,
    post: Post,
): string | undefined {
    const extra = item as { posterUrl?: string; thumbnailUrl?: string; thumbnail_url?: string } | undefined;
    const postExtra = post as { thumbnailUrl?: string; thumbnail_url?: string };
    const fromItem = firstMediaUri(
        extra?.posterUrl,
        extra?.thumbnailUrl,
        extra?.thumbnail_url,
    );
    if (fromItem && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(fromItem)) return fromItem;

    const items = (post.mediaItems || []).filter(
        (entry) => entry?.type === 'image' || entry?.type === 'video',
    );
    const firstVideo = items.find((entry) => entry?.type === 'video');
    const isFirstVideo = !item || item === firstVideo || (!!firstVideo && item.url === firstVideo.url);
    if (isFirstVideo) {
        const postPoster = firstMediaUri(
            post.videoPosterUrl,
            postExtra.thumbnailUrl,
            postExtra.thumbnail_url,
        );
        if (postPoster && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(postPoster)) return postPoster;
    }

    return siblingJpegFromVideoUrl(item?.url || resolvePostPlaybackUri(post, item));
}

export type FeedPostMediaHandle = {
    toggleVideoMute: () => void;
    /** Web feed: single tap re-shows mute icon for ~2s without toggling. */
    flashMuteControl: () => void;
    /** Parent tap layer can trigger in-media burst at local coords. */
    showLikeBurstAt: (x: number, y: number) => void;
    /** Flush current MP4 time so Scenes / return-to-postcard can resume. */
    getPlaybackHandoff: () => { currentTime: number; muted: boolean };
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
    /** Window coords for the feed-level burst portal (TextureView covers in-card FX on Android). */
    onLikeBurst?: (windowX: number, windowY: number) => void;
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
    /** Hide mute / Scenes CTA while this card's player is expanded fullscreen. */
    hideOverlayChrome?: boolean;
    /** Fill the expanding viewport and letterbox the video (no 4:5 crop-zoom). */
    fillViewport?: boolean;
    /** Natural pixel size of the current slide — parent sizes the frame from this. */
    onNaturalSize?: (width: number, height: number) => void;
};

const FeedPostMedia = React.memo(
    React.forwardRef<FeedPostMediaHandle, Props>(function FeedPostMedia(
    {
        post,
        carouselIndex = 0,
        onCarouselIndexChange,
        width,
        height,
        onPress,
        onDoubleLike,
        onLikeBurst: _onLikeBurst,
        onSingleTap,
        stickers,
        onMediaLoad,
        mode = 'feed',
        isActive: _isActive = false,
        suspendNativeVideo = false,
        muted = true,
        style,
        onOpenScenes,
        hideOverlayChrome = false,
        fillViewport = false,
        onNaturalSize,
    },
    ref,
) {
    const windowSlideWidth = Dimensions.get('window').width;
    const [pageWidth, setPageWidth] = useState(() =>
        width > 0 ? width : windowSlideWidth,
    );
    const [pageHeight, setPageHeight] = useState(() => (height > 0 ? height : 1));
    const slideWidth = pageWidth > 0 ? pageWidth : windowSlideWidth;
    const slideHeight = fillViewport && pageHeight > 0 ? pageHeight : height;
    const [loadingByUrl, setLoadingByUrl] = useState<Record<string, boolean>>({});
    const [paused, setPaused] = useState(mode === 'feed');
    const [playFailed, setPlayFailed] = useState(false);
    const pendingSeekRef = useRef<number | null>(null);
    const playbackTimeRef = useRef(0);
    /** Don't fade the poster until ExoPlayer has seeked to the Scenes resume time. */
    const waitingForResumeFrameRef = useRef<number | null>(null);
    /** Per-raw-URL remote fallback after local/demo path fails (mirrors web Media). */
    const [videoUrlFallbackByRaw, setVideoUrlFallbackByRaw] = useState<Record<string, string>>({});
    const [soundOn, setSoundOn] = useState(!muted);
    const [muteFlash, setMuteFlash] = useState(false);
    const loadedUrlsRef = useRef<Set<string>>(new Set());
    const mediaLoadReportedRef = useRef(false);
    const carouselListRef = useRef<FlatList>(null);
    const feedVideoRef = useRef<VideoRef>(null);
    const lastEmittedIndexRef = useRef(0);
    const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);
    const clearBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Sticky Scenes resume time — not overwritten by remount progress at t≈0. */
    const stickyResumeTimeRef = useRef<number | null>(null);
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
    const [isLandscapeMedia, setIsLandscapeMedia] = useState(false);
    const onNaturalSizeRef = useRef(onNaturalSize);
    onNaturalSizeRef.current = onNaturalSize;

    const applyNaturalSize = useCallback((w: number, h: number) => {
        if (!(Number(w) > 0 && Number(h) > 0)) return;
        const nextLandscape = Number(w) > Number(h);
        setIsLandscapeMedia((prev) => (prev === nextLandscape ? prev : nextLandscape));
        onNaturalSizeRef.current?.(Number(w), Number(h));
    }, []);

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
            if (!hasCarousel || !slideWidth) return;
            const next = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
            const clamped = Math.max(0, Math.min(next, maxCarouselIndex));
            if (clamped === currentIndex) return;
            lastEmittedIndexRef.current = clamped;
            setCurrentIndex(clamped);
            requestAnimationFrame(() => onCarouselIndexChange?.(clamped));
        },
        [currentIndex, hasCarousel, maxCarouselIndex, onCarouselIndexChange, slideWidth],
    );

    useEffect(() => {
        loadedUrlsRef.current.clear();
        mediaLoadReportedRef.current = false;
        setLoadingByUrl({});
        setCurrentIndex(0);
        lastEmittedIndexRef.current = 0;
        setPlayFailed(false);
        setVideoUrlFallbackByRaw({});
        setIsLandscapeMedia(false);
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
        if (!hasCarousel || !slideWidth) return;
        if (safeCarouselIndex === currentIndex) return;
        if (safeCarouselIndex === lastEmittedIndexRef.current) {
            setCurrentIndex(safeCarouselIndex);
            return;
        }
        lastEmittedIndexRef.current = safeCarouselIndex;
        setCurrentIndex(safeCarouselIndex);
        carouselListRef.current?.scrollToOffset({
            offset: safeCarouselIndex * slideWidth,
            animated: false,
        });
    }, [currentIndex, hasCarousel, safeCarouselIndex, slideWidth]);

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
    const posterUriForSize = resolveFeedVideoPosterUri(activeItem, post);

    useEffect(() => {
        if (!posterUriForSize) return;
        Image.getSize(
            posterUriForSize,
            (w, h) => {
                applyNaturalSize(w, h);
            },
            () => {},
        );
    }, [posterUriForSize, applyNaturalSize]);
    const showScenesCta =
        mode === 'feed' &&
        video &&
        postHasVideoMedia(post) &&
        Boolean(onOpenScenes) &&
        !hideOverlayChrome;
    const showMuteButton = video && mode === 'feed' && isFeedAutoplayActive && !hideOverlayChrome;

    useEffect(() => {
        if (suspendNativeVideo) {
            needsRemountAfterSuspendRef.current = true;
        }
    }, [suspendNativeVideo]);

    const fireBurstAt = useCallback((x: number, y: number) => {
        setBurstAt({ x, y });
        setBurstKey((k) => k + 1);
        if (clearBurstTimerRef.current) {
            clearTimeout(clearBurstTimerRef.current);
        }
        clearBurstTimerRef.current = setTimeout(() => {
            setBurstAt(null);
            clearBurstTimerRef.current = null;
        }, 900);
    }, []);

    const lastTapAtRef = useRef(0);
    const pendingMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelPendingMediaTap = useCallback(() => {
        if (pendingMuteTimerRef.current) {
            clearTimeout(pendingMuteTimerRef.current);
            pendingMuteTimerRef.current = null;
        }
        lastTapAtRef.current = 0;
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            toggleVideoMute: () => {
                if (!video || mode !== 'feed') return;
                cancelPendingMediaTap();
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
                onDoubleLike?.(x, y);
            },
            getPlaybackHandoff: () => ({
                currentTime: playbackTimeRef.current,
                muted: !soundOn,
            }),
        }),
        [cancelPendingMediaTap, fireBurstAt, mode, onDoubleLike, soundOn, video],
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

        if (suspendNativeVideo) {
            // Covered by Scenes / comments — pause in place. Never seek to 0.
            if (playbackTimeRef.current > 0.05) {
                setFeedVideoHandoff(String(post.id), {
                    currentTime: playbackTimeRef.current,
                    muted: !soundOn,
                    mediaUrl: mediaUrl,
                });
            }
            setPaused(true);
            return;
        }

        if (!isFeedAutoplayActive) {
            setPaused((wasPaused) => (wasPaused ? wasPaused : true));
            const scrolledToAnotherPost =
                storeActivePostId != null && String(storeActivePostId) !== String(post.id);
            if (scrolledToAnotherPost) {
                pendingSeekRef.current = null;
                waitingForResumeFrameRef.current = null;
                stickyResumeTimeRef.current = null;
                playbackTimeRef.current = 0;
                resetPosterCover();
                try {
                    feedVideoRef.current?.seek?.(0);
                } catch {
                    /* ignore */
                }
            }
            return;
        }

        const handoff = peekFeedVideoHandoff(String(post.id));
        const resumeAt =
            handoff && Number.isFinite(handoff.currentTime) && handoff.currentTime > 0.05
                ? handoff.currentTime
                : playbackTimeRef.current > 0.05
                  ? playbackTimeRef.current
                  : null;
        if (resumeAt != null) {
            pendingSeekRef.current = resumeAt;
            playbackTimeRef.current = resumeAt;
            stickyResumeTimeRef.current = resumeAt;
        }
        if (handoff?.fromScenes) {
            consumeFeedVideoHandoff(String(post.id));
        }
        if (needsRemountAfterSuspendRef.current) {
            needsRemountAfterSuspendRef.current = false;
            if (resumeAt != null) {
                waitingForResumeFrameRef.current = resumeAt;
                resetPosterCover();
            }
            setPlayerEpoch((n) => n + 1);
        }
        setPaused(false);
        setPlayFailed(false);
    }, [
        isFeedAutoplayActive,
        mediaUrl,
        mode,
        post.id,
        resetPosterCover,
        soundOn,
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
            lineHeight: getTextOnlyLineHeight(post),
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

    const handleDoubleLikeAt = useCallback(
        (localX?: number, localY?: number) => {
            fireBurstAt(width / 2, height / 2);
            onDoubleLike?.(localX, localY);
        },
        [fireBurstAt, height, onDoubleLike, width],
    );

    const handleMediaTap = useCallback(
        (localX: number, localY: number, _absX: number, _absY: number) => {
            const tapX = Number.isFinite(localX) ? localX : 0;
            const tapY = Number.isFinite(localY) ? localY : 0;
            const frameW = width > 0 ? width : 1;
            const aspect = isLandscapeMedia ? 16 / 9 : 4 / 5;
            const frameH = width > 0 ? Math.min(width / aspect, height > 0 ? height : width / aspect) : 1;
            // Mute control (bottom-right) and Scenes CTA (bottom-left) must not toggle mute.
            if (tapY > frameH - 56 && (tapX > frameW - 56 || tapX < 160)) {
                return;
            }
            const now = Date.now();
            if (lastTapAtRef.current > 0 && now - lastTapAtRef.current < DOUBLE_TAP_MS) {
                cancelPendingMediaTap();
                handleDoubleLikeAt(tapX, tapY);
                return;
            }
            lastTapAtRef.current = now;
            if (pendingMuteTimerRef.current) {
                clearTimeout(pendingMuteTimerRef.current);
            }
            pendingMuteTimerRef.current = setTimeout(() => {
                pendingMuteTimerRef.current = null;
                handleFullscreen();
            }, DOUBLE_TAP_MS);
        },
        [cancelPendingMediaTap, handleDoubleLikeAt, handleFullscreen, height, isLandscapeMedia, width],
    );

    useEffect(
        () => () => {
            if (pendingMuteTimerRef.current) {
                clearTimeout(pendingMuteTimerRef.current);
            }
        },
        [],
    );

    const mediaTapGesture = useMemo(() => {
        // One Tap recognizer — Exclusive(double, single) fires mute on the first tap on Android.
        // Wrapper CONTAINS the video (StorySwipeLayer pattern). An overlay with elevation
        // casts a halo and hides TextureView on ColorOS.
        const tap = Gesture.Tap()
            .enabled(feedTapCapture)
            .numberOfTaps(1)
            .maxDuration(500)
            .maxDistance(28)
            .shouldCancelWhenOutside(false)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleMediaTap)(e.x, e.y, e.absoluteX, e.absoluteY);
            });
        if (hasCarousel) {
            return Gesture.Simultaneous(Gesture.Native(), tap);
        }
        return tap;
    }, [feedTapCapture, handleMediaTap, hasCarousel]);

    const handleOpenScenesPress = useCallback(() => {
        onOpenScenes?.();
    }, [onOpenScenes]);

    if (textOnly) {
        return (
            <Pressable onPress={onPress} style={[styles.wrap, { width, minHeight: height * 0.55 }, style]}>
                <View style={[styles.textOnlyCard, { backgroundColor: textOnlyStyle?.backgroundColor }]}>
                    <Text style={[styles.textOnlyBody, { color: textOnlyStyle?.color, fontSize: textOnlyStyle?.fontSize, lineHeight: textOnlyStyle?.lineHeight }]}>
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
    const mediaFit = isLandscapeMedia ? 'contain' : 'cover';

    useEffect(() => {
        const next = width > 0 ? width : windowSlideWidth;
        setPageWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
        if (!fillViewport && height > 0) {
            setPageHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
        }
    }, [fillViewport, height, width, windowSlideWidth]);

    const onFrameLayout = useCallback(
        (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
            const nextW = Math.round(e.nativeEvent.layout.width);
            const nextH = Math.round(e.nativeEvent.layout.height);
            if (nextW > 0) {
                setPageWidth((prev) => (Math.abs(prev - nextW) > 1 ? nextW : prev));
            }
            if (nextH > 0) {
                setPageHeight((prev) => (Math.abs(prev - nextH) > 1 ? nextH : prev));
            }
        },
        [],
    );

    // Parent (FeedCard) owns the frame height. Numeric slide width — never % —
    // so Android paging cannot squeeze two slides into one viewport.
    const frameBoxStyle = fillViewport
        ? {
              width: '100%' as const,
              height: '100%' as const,
              overflow: 'hidden' as const,
              backgroundColor: '#000000',
          }
        : {
              width: '100%' as const,
              height,
              overflow: 'hidden' as const,
              backgroundColor: '#121212',
          };
    const frameStyle = frameBoxStyle;
    const slideBoxStyle = {
        width: slideWidth,
        height: fillViewport ? slideHeight : height,
        overflow: 'hidden' as const,
        backgroundColor: '#121212' as const,
    };

    const renderSlide = (
        item: (typeof carouselItems)[number],
        slideIndex: number,
    ) => {
        const slideRawUrl = resolvePostPlaybackUri(post, item) || item?.url || post.mediaUrl;
        if (!slideRawUrl) {
            return <View style={styles.slideFill} collapsable={false} />;
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
                <View style={styles.slideFill} collapsable={false}>
                    <Image
                        source={{ uri: slideUrl }}
                        style={{ width: slideWidth, height: fillViewport ? slideHeight : height }}
                        resizeMode={mediaFit}
                        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                        progressiveRenderingEnabled={false}
                        pointerEvents={mediaPointerEvents}
                        onLoadStart={() => beginUrlLoad(slideRawUrl)}
                        onLoad={(e) => {
                            markUrlLoaded(slideRawUrl);
                            if (!slideIsCurrent) return;
                            const src = e.nativeEvent.source;
                            if (src && Number(src.width) > 0 && Number(src.height) > 0) {
                                applyNaturalSize(Number(src.width), Number(src.height));
                            }
                        }}
                        onError={() => markUrlLoaded(slideRawUrl)}
                    />
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
            <View style={styles.slideFill} collapsable={false}>
                {slideMountVideo ? (
                    <FeedPlayingVideo
                        remountEpoch={playerEpoch}
                        source={cachedVideoSource}
                        paused={mode === 'detail' ? paused : !isViewable}
                        muted={mode === 'feed' ? !soundOn : false}
                        volume={mode === 'detail' ? 1 : soundOn ? 1 : 0}
                        repeat={mode === 'feed'}
                        posterUri={slidePosterUri}
                        resizeMode={fillViewport ? 'contain' : mediaFit}
                        boxWidth={slideWidth}
                        boxHeight={fillViewport ? slideHeight : height}
                        pointerEvents={mediaPointerEvents}
                        videoRef={feedVideoRef}
                        onLoadStart={() => {
                            beginUrlLoad(slideRawUrl);
                        }}
                        onReady={() => {
                            if (waitingForResumeFrameRef.current != null) return;
                            onFirstFrameReady();
                        }}
                        onLoad={(meta) => {
                            const seekTo =
                                pendingSeekRef.current ??
                                stickyResumeTimeRef.current ??
                                (playbackTimeRef.current > 0.05 ? playbackTimeRef.current : null);
                            if (
                                seekTo != null &&
                                Number.isFinite(seekTo) &&
                                seekTo > 0.05 &&
                                feedVideoRef.current
                            ) {
                                pendingSeekRef.current = null;
                                waitingForResumeFrameRef.current = seekTo;
                                try {
                                    feedVideoRef.current.seek(seekTo);
                                } catch {
                                    waitingForResumeFrameRef.current = null;
                                    onFirstFrameReady();
                                }
                            } else {
                                onFirstFrameReady();
                            }
                            const ns = meta?.naturalSize;
                            if (ns && Number(ns.width) > 0 && Number(ns.height) > 0) {
                                applyNaturalSize(Number(ns.width), Number(ns.height));
                            }
                        }}
                        onProgress={(e) => {
                            const t = e?.currentTime;
                            if (typeof t !== 'number' || !Number.isFinite(t)) return;
                            const resumeAt = stickyResumeTimeRef.current;
                            // Remount reports t≈0 before seek — ignore until we land near resume.
                            if (resumeAt != null && resumeAt > 0.05 && t < resumeAt - 0.35) {
                                return;
                            }
                            playbackTimeRef.current = t;
                            if (resumeAt != null && t >= resumeAt - 0.3) {
                                stickyResumeTimeRef.current = null;
                                waitingForResumeFrameRef.current = null;
                                onFirstFrameReady();
                            } else if (
                                waitingForResumeFrameRef.current != null &&
                                t >= waitingForResumeFrameRef.current - 0.3
                            ) {
                                waitingForResumeFrameRef.current = null;
                                onFirstFrameReady();
                            }
                            setFeedVideoHandoff(String(post.id), {
                                currentTime: t,
                                muted: !soundOn,
                                mediaUrl: slideRawUrl,
                            });
                        }}
                        onError={(e) => onVideoError(slideRawUrl, e)}
                    />
                ) : null}

                {slidePosterUri && showBufferCover ? (
                    <Animated.Image
                        source={{ uri: slidePosterUri }}
                        style={[
                            styles.posterCover,
                            { opacity: slideMountVideo ? posterOpacity : 1 },
                        ]}
                        resizeMode={mediaFit}
                        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                        pointerEvents="none"
                        onLoad={() => markUrlLoaded(slideRawUrl)}
                        onError={() => markUrlLoaded(slideRawUrl)}
                    />
                ) : null}
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
                <FlatList
                    ref={carouselListRef}
                    data={carouselItems}
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    directionalLockEnabled
                    bounces={false}
                    overScrollMode="never"
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    disableIntervalMomentum
                    snapToInterval={slideWidth}
                    snapToAlignment="start"
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={onCarouselScrollEnd}
                    keyExtractor={(item, index) => `${post.id}-carousel-${index}-${item.url}`}
                    extraData={`${currentIndex}-${isViewable}-${suspendNativeVideo}-${playerEpoch}`}
                    getItemLayout={(_, index) => ({
                        length: slideWidth,
                        offset: slideWidth * index,
                        index,
                    })}
                    windowSize={3}
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    removeClippedSubviews={false}
                    style={slideBoxStyle}
                    renderItem={({ item, index }) => (
                        <View style={slideBoxStyle} collapsable={false}>
                            {renderSlide(item, index)}
                        </View>
                    )}
                />
            ) : (
                <View style={styles.slideFill}>{inner}</View>
            )}
        </>
    );

    const mediaCard = (
        <View
            style={[styles.wrap, frameStyle, style]}
            collapsable={false}
            onLayout={onFrameLayout}
            accessibilityRole={feedTapCapture ? 'button' : undefined}
            accessibilityLabel={feedTapCapture ? 'Double tap to like' : undefined}
        >
            {feedTapCapture ? (
                <GestureDetector gesture={mediaTapGesture}>
                    <View style={styles.slideFill} collapsable={false}>
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
            {showScenesCta ? (
                <VideoCTAOverlay
                    onPress={() => {
                        cancelPendingMediaTap();
                        handleOpenScenesPress();
                    }}
                    userHandle={post.userHandle}
                />
            ) : null}
            {showMuteButton ? (
                <GesturePressable
                    style={styles.muteButton}
                    onPress={() => {
                        cancelPendingMediaTap();
                        setFeedSoundOn(!soundOn);
                        setMuteFlash(true);
                        setTimeout(() => setMuteFlash(false), 1100);
                    }}
                    hitSlop={8}
                >
                    <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={14} color="#FFFFFF" />
                </GesturePressable>
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
            <View style={styles.burstLayer} pointerEvents="none" collapsable={false}>
                {burstAt ? (
                    <FeedDoubleTapLikeBurst key={burstKey} centered />
                ) : null}
            </View>
        </View>
    );

    return mediaCard;
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
            prev.hideOverlayChrome === next.hideOverlayChrome &&
            prev.fillViewport === next.fillViewport &&
            prev.carouselIndex === next.carouselIndex &&
            Boolean(prev.onLikeBurst) === Boolean(next.onLikeBurst) &&
            Boolean(prev.onDoubleLike) === Boolean(next.onDoubleLike) &&
            JSON.stringify(a.mediaItems) === JSON.stringify(b.mediaItems)
        );
    },
);

export default FeedPostMedia;

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignSelf: 'stretch',
        position: 'relative',
        overflow: 'hidden',
    },
    slideFill: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#121212',
        position: 'relative',
    },
    mediaFrame: {
        width: '100%',
        alignSelf: 'stretch',
        overflow: 'hidden',
        backgroundColor: '#121212',
        position: 'relative',
    },
    videoClip: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#121212',
    },
    stillImage: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        opacity: 1,
    },
    /** Fill the slide — percentage of the numeric-width page, not of content. */
    videoFill: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    /** Sits above Video until first frame, then faded/unmounted. */
    posterCover: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        zIndex: 2,
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
        zIndex: 30,
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
        fontWeight: '500',
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
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        overflow: 'hidden',
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
