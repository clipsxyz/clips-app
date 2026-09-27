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
import Reanimated, {
    createAnimatedComponent,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import type { Post, PostMediaItem, StickerOverlay } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import {
    getActiveFeedVideoPostId,
    getFeedTextureMountAllowed,
    subscribeActiveFeedVideo,
    registerFeedVideoPlayer,
    setAllFeedPlayerVolumes,
    subscribeFeedPlaybackAllowed,
    subscribeFeedTextureMountAllowed,
} from '../utils/feedActiveVideoNative';
import {
    getFeedUiThreadScrollY,
    setFeedUiThreadAnchor,
    useFeedUiThreadSilenceNet,
} from '../utils/feedViewabilityUiThread';
import { getFeedScrollBusy } from '../utils/feedScrollBusyNative';
import { consumeFeedVideoHandoff, peekFeedVideoHandoff, setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';
import { androidListSafeVideoProps, hasValidVideoFrame } from '../utils/androidSafeVideoNative';
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
import { FEED_UI } from '../constants/feedUiTokens';
import {
    FEED_COLLAPSE_DURATION_MS,
    armAndExpandOnUIThread,
    beginFeedExpandDrag,
    cacheFeedExpandCard,
    getFeedExpandCard,
    getFeedExpandScreen,
    getFeedExpandTargetPostId,
    dragFeedExpand,
    endFeedExpandDrag,
    computeExpandTransform,
    isExpandTargetCard,
    armFeedExpand,
    getFeedExpandProgress,
    getFeedExpandTarget,
    runFeedExpandAnimation,
    runFeedExpandSnapBack,
    runFeedCollapseAnimation,
    subscribeFeedExpand,
    type FeedExpandTarget,
} from '../utils/feedFullscreenExpandNative';
import { useWindowDimensions } from 'react-native';

const ANDROID_FEED_VIDEO_PROPS = androidListSafeVideoProps();

/**
 * The media card is an animated component purely so the expand transform can be
 * applied as a style. Declared once at module scope: recreating it would remount
 * every visible card (and therefore every ExoPlayer) on each render.
 */
const AnimatedFeedMediaCard = createAnimatedComponent(View);

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
    const cacheKey = `v4|${rawUrl || ''}|${sourceUri}`;
    const cached = FEED_VIDEO_SOURCE_CACHE.get(cacheKey);
    if (cached) return cached;

    let source: object;
    if (isPlayableLocalMediaUri(rawUrl) || isPlayableLocalMediaUri(uri)) {
        source = { uri: rawUrl && isPlayableLocalMediaUri(rawUrl) ? rawUrl : uri };
    } else if (rawUrl && isMockDemoVideoPath(rawUrl)) {
        source = withFeedVideoCache(mockFeedVideoSource(rawUrl) as object) as object;
    } else if (isMockDemoVideoPath(uri)) {
        source = withFeedVideoCache(mockFeedVideoSource(uri) as object) as object;
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
    clipRadius?: number;
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
    clipRadius = 0,
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

    const [frameReady, setFrameReady] = useState(false);
    const notifiedReadyRef = useRef(false);

    useEffect(() => {
        setFrameReady(false);
        notifiedReadyRef.current = false;
    }, [remountEpoch]);

    useEffect(() => {
        const node = videoRef as { current?: { pause: () => void; setVolume: (n: number) => void } | null };
        let unreg = () => {};
        const attach = () => {
            const player = node?.current;
            if (!player) return false;
            unreg = registerFeedVideoPlayer(player);
            return true;
        };
        if (attach()) {
            return () => unreg();
        }
        const id = requestAnimationFrame(() => {
            attach();
        });
        return () => {
            cancelAnimationFrame(id);
            unreg();
        };
    }, [remountEpoch, videoRef]);

    useEffect(() => {
        const player = (videoRef as { current?: { pause: () => void; setVolume: (n: number) => void } | null })
            ?.current;
        if (!player) return;
        try {
            if (paused || muted || volume <= 0) {
                player.setVolume(0);
                if (paused) player.pause();
            } else {
                // Restore audio after haltAllPlayers / warm-mute — ColorOS needs an
                // explicit setVolume(1) when this card becomes the audible slot.
                player.setVolume(volume);
            }
        } catch {
            /* ignore */
        }
    }, [paused, muted, volume, videoRef]);

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
        borderRadius: clipRadius > 0 ? clipRadius : 0,
    };

    const markReady = () => {
        if (notifiedReadyRef.current) return;
        notifiedReadyRef.current = true;
        setFrameReady(true);
        onReadyRef.current();
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
                playWhenInactive={false}
                progressUpdateInterval={150}
                ignoreSilentSwitch="ignore"
                mixWithOthers="duck"
                hideShutterView
                useTextureView
                poster={poster}
                {...ANDROID_FEED_VIDEO_PROPS}
                pointerEvents="none"
                onLoadStart={() => onLoadStartRef.current()}
                onReadyForDisplay={() => {
                    // One frame is enough to avoid a half-drawn TextureView flash.
                    requestAnimationFrame(markReady);
                }}
                onLoad={(meta) => onLoadRef.current(meta)}
                onProgress={(e) => {
                    const t = e?.currentTime;
                    if (typeof t === 'number' && t > 0.12) markReady();
                    onProgressRef.current(e);
                }}
                onError={(e) => onErrorRef.current(e)}
            />
            {posterUri && !frameReady ? (
                <Image
                    source={{ uri: posterUri }}
                    style={[videoBox, StyleSheet.absoluteFillObject]}
                    resizeMode="cover"
                    pointerEvents="none"
                />
            ) : null}
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
    prev.boxHeight === next.boxHeight &&
    prev.clipRadius === next.clipRadius
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
    /**
     * Bumped by the owning screen on every focus return. The card hard-forces its
     * native audio session when this changes, because `muted`/`volume` are derived
     * from local `soundOn` and therefore do NOT change across a blur round-trip —
     * without an explicit signal React forwards nothing and ExoPlayer stays at 0.
     */
    focusEpoch?: number;
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
        focusEpoch = 0,
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
    /**
     * Explicit user pause from a tap while this card owns the fullscreen viewport.
     *
     * Deliberately separate from `paused`, which the autoplay effect above owns and
     * rewrites whenever the active slot changes — folding a user intent into it would
     * mean the next scroll or focus change silently undid the pause. This ANDs into the
     * native `paused`/`muted`/`volume`/`repeat` props only while expanded, and is reset
     * the moment the card leaves fullscreen.
     */
    const [expandedUserPaused, setExpandedUserPaused] = useState(false);
    const pendingSeekRef = useRef<number | null>(null);
    const playbackTimeRef = useRef(0);
    const lastHandoffAtRef = useRef(0);
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
    /** Own id only. Other cards must not setState when the active clip changes. */
    const [storeActivePostId, setStoreActivePostId] = useState<string | null>(() => {
        const id = getActiveFeedVideoPostId();
        return id != null && String(id) === String(post.id) ? id : null;
    });
    const [isLandscapeMedia, setIsLandscapeMedia] = useState(
        () => width > 0 && height > 0 && width > height * 1.15,
    );
    const onNaturalSizeRef = useRef(onNaturalSize);
    onNaturalSizeRef.current = onNaturalSize;

    const applyNaturalSize = useCallback((w: number, h: number) => {
        if (!(Number(w) > 0 && Number(h) > 0)) return;
        const nextLandscape = Number(w) > Number(h);
        const playing =
            mode === 'feed' && String(getActiveFeedVideoPostId()) === String(post.id);
        setIsLandscapeMedia((prev) => {
            if (prev === nextLandscape) return prev;
            if (playing) return prev;
            return nextLandscape;
        });
        if (!playing) onNaturalSizeRef.current?.(Number(w), Number(h));
    }, [mode, post.id]);

    const resetPosterCover = useCallback(() => {
        mediaRevealRef.current?.stop();
        mediaRevealRef.current = null;
        posterOpacity.setValue(1);
        videoOpacity.setValue(0);
        setVideoSurfaceReady(false);
        setPosterMounted(true);
    }, [posterOpacity, videoOpacity]);

    const fadeOutPosterCover = useCallback((duration = 180) => {
        setVideoSurfaceReady((prev) => {
            if (prev) return prev;
            mediaRevealRef.current?.stop();
            videoOpacity.setValue(1);
            if (duration <= 0) {
                posterOpacity.setValue(0);
                return true;
            }
            mediaRevealRef.current = Animated.timing(posterOpacity, {
                toValue: 0,
                duration,
                useNativeDriver: true,
            });
            mediaRevealRef.current.start();
            return true;
        });
    }, [posterOpacity, videoOpacity]);

    useEffect(() => {
        if (mode !== 'feed') return;
        if (!postHasVideoMedia(post)) return;
        const mine = String(post.id);
        return subscribeActiveFeedVideo((id) => {
            const next = id != null && String(id) === mine ? id : null;
            setStoreActivePostId((prev) => (prev === next ? prev : next));
        });
    }, [mode, post.id]);

    // Exactly one feed Video may mount — the settled audible postcard.
    const isAudible =
        mode === 'feed' &&
        !suspendNativeVideo &&
        String(storeActivePostId) === String(post.id);

    /**
     * Arm the UI-thread guard for this card.
     *
     * The anchor is captured at hand-off, when the card is the settled audible
     * slot and therefore fills the viewport — so the scroll offset at that moment
     * is where its top sat in content space. That is what lets the UI thread score
     * visibility from a bare scroll offset instead of a per-row `measureLayout`.
     *
     * Only the audible card is ever armed, matching the invariant that at most
     * one player is mounted and therefore at most one card can bleed audio.
     */
    useEffect(() => {
        if (!isAudible) {
            setFeedUiThreadAnchor(null);
            return;
        }
        setFeedUiThreadAnchor({
            anchorY: getFeedUiThreadScrollY(),
            cardHeight: pageHeight > 0 ? pageHeight : 0,
        });
        // Revoke on unmount too: a lingering anchor would guard a card that no
        // longer exists, and its scroll deltas would be meaningless.
        return () => setFeedUiThreadAnchor(null);
    }, [isAudible, pageHeight, post.id]);

    const [feedPlaybackAllowed, setFeedPlaybackAllowedState] = useState(true);
    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedPlaybackAllowed(setFeedPlaybackAllowedState);
    }, [mode]);
    const [textureMountAllowed, setTextureMountAllowed] = useState(getFeedTextureMountAllowed);
    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedTextureMountAllowed(setTextureMountAllowed);
    }, [mode]);

    if (mode === 'feed' && !isAudible) {
        posterOpacity.setValue(1);
    }

    // Bluesky destroy(): when not active, release the player (unmount + pause).
    useEffect(() => {
        if (mode !== 'feed') return;
        if (isAudible) return;
        resetPosterCover();
        try {
            feedVideoRef.current?.pause?.();
            feedVideoRef.current?.setVolume?.(0);
        } catch {
            /* ignore */
        }
    }, [mode, isAudible, resetPosterCover]);
    const isFeedAutoplayActive = isAudible;

    /**
     * Force the native ExoPlayer back onto React's *visual* mute state.
     *
     * The blur cleanup above (and `silencePlayer` in the store) leave the native
     * player at volume 0, but `muted`/`volume` are derived from local `soundOn`, so
     * they are unchanged across a blur round-trip and React forwards no new value.
     * The result is the reported desync: the icon reads "unmuted" over a silent
     * player, and the first sound tap only re-mutes. Re-assert on the ref whenever
     * this card owns the slot, and again on load for a remounted player.
     */
    const syncFeedPlayerVolume = useCallback(() => {
        if (mode !== 'feed') return;
        const handle = feedVideoRef.current;
        if (!handle) return;
        try {
            handle.setVolume?.(soundOn ? 1 : 0);
            if (soundOn && feedPlaybackAllowed) handle.resume?.();
            else handle.pause?.();
        } catch {
            /* ColorOS ExoPlayer can already be released */
        }
    }, [feedPlaybackAllowed, mode, soundOn]);

    useEffect(() => {
        if (!isAudible) return;
        syncFeedPlayerVolume();
    }, [isAudible, syncFeedPlayerVolume]);

    /**
     * UI-thread visibility guard.
     *
     * FlashList viewability arrives on the JS thread, so a busy JS thread can
     * leave an already-scrolled-past clip audible for a few frames. This scores
     * the 50% bar on the UI thread every scroll frame and hard-pauses the moment
     * it fails.
     *
     * Imperative only — no setState, no re-render, and it can never *play*: the
     * upward crossing deliberately does nothing, because resuming is the JS
     * layer's decision (overlay gating, Wi-Fi prefs, focus, the settle
     * hand-off). Veto-only is what makes it safe to run this early and often.
     */
    useFeedUiThreadSilenceNet(useCallback(() => {
        if (mode !== 'feed') return;
        try {
            feedVideoRef.current?.pause?.();
            feedVideoRef.current?.setVolume?.(0);
        } catch {
            /* ignore — ColorOS ExoPlayer can already be released */
        }
    }, [mode]));

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

    const applyCarouselIndex = useCallback(
        (rawIndex: number) => {
            if (!hasCarousel || !slideWidth) return;
            const clamped = Math.max(0, Math.min(rawIndex, maxCarouselIndex));
            if (clamped === lastEmittedIndexRef.current) return;
            lastEmittedIndexRef.current = clamped;
            setCurrentIndex(clamped);
            onCarouselIndexChange?.(clamped);
        },
        [hasCarousel, maxCarouselIndex, onCarouselIndexChange, slideWidth],
    );

    const onCarouselScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!hasCarousel || !slideWidth) return;
            applyCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
        },
        [applyCarouselIndex, hasCarousel, slideWidth],
    );

    const onCarouselScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!hasCarousel || !slideWidth) return;
            applyCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
        },
        [applyCarouselIndex, hasCarousel, slideWidth],
    );

    useEffect(() => {
        loadedUrlsRef.current.clear();
        mediaLoadReportedRef.current = false;
        setLoadingByUrl({});
        setCurrentIndex(0);
        lastEmittedIndexRef.current = 0;
        setPlayFailed(false);
        setVideoUrlFallbackByRaw({});
        setIsLandscapeMedia(width > 0 && height > 0 && width > height * 1.15);
        // FlashList recycles this card — destroy the native TextureView or the
        // previous post's picture stays pinned in the top-left.
        setPlayerEpoch((n) => n + 1);
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

    /**
     * Unconditional focus-return force.
     *
     * The `isAudible` effect above only fires when the active-slot id actually flips.
     * Navigating back into the feed can re-claim the same card (or have the id restored
     * before this card re-renders), in which case nothing changes and the imperative
     * `setVolume(0)` left by the blur cleanup is never reversed. A focus epoch always
     * changes, so this re-asserts unconditionally.
     *
     * `resume()` is called as well as `setVolume()`: on ColorOS a still-paused ExoPlayer
     * ignores the volume update, which is the "icon says unmuted but the clip is dead"
     * state. The rAF retry covers a player whose TextureView is still attaching.
     */
    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        if (!isAudible) return;
        let cancelled = false;
        const force = () => {
            if (cancelled) return;
            const player = feedVideoRef.current as {
                setVolume?: (n: number) => void;
                resume?: () => void;
                pause?: () => void;
            } | null;
            if (!player) return;
            try {
                player.setVolume?.(soundOn ? 1 : 0);
                if (soundOn) player.resume?.();
                else player.pause?.();
            } catch {
                /* ColorOS ExoPlayer can already be released */
            }
        };
        force();
        // One more pass next frame: the TextureView may attach its ref after this commit.
        const id = requestAnimationFrame(force);
        return () => {
            cancelled = true;
            cancelAnimationFrame(id);
        };
    }, [focusEpoch, isAudible, mode, soundOn, video]);

    useEffect(() => {
        if (!posterUriForSize) return;
        let cancelled = false;
        Image.getSize(
            posterUriForSize,
            (w, h) => {
                if (!cancelled) applyNaturalSize(w, h);
            },
            () => {},
        );
        return () => {
            cancelled = true;
        };
    }, [posterUriForSize, applyNaturalSize]);
    const showScenesCta =
        mode === 'feed' &&
        video &&
        postHasVideoMedia(post) &&
        Boolean(onOpenScenes) &&
        !hideOverlayChrome;
    const showMuteButton = video && mode === 'feed' && isFeedAutoplayActive && !hideOverlayChrome;

    /* ------------------------------------------------------------------ *
     * Fullscreen tap-to-pause feedback
     *
     * Mirrors the Scenes viewer pill: Reanimated drives the whole animation on the UI
     * thread so the badge lands on the very next frame and the imperative pause() is
     * not waiting on a React commit.
     * ------------------------------------------------------------------ */
    const playPauseOpacity = useSharedValue(0);
    const playPauseScale = useSharedValue(1);
    const playPauseIsPaused = useSharedValue(false);
    const playPauseHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showPlayPausePill = useCallback(() => {
        playPauseIsPaused.value = expandedUserPaused;
        playPauseScale.value = 0.8;
        playPauseOpacity.value = withTiming(1, { duration: 120 });
        playPauseScale.value = withTiming(1, { duration: 180 });
        if (playPauseHoldTimerRef.current) clearTimeout(playPauseHoldTimerRef.current);
        playPauseHoldTimerRef.current = setTimeout(() => {
            playPauseOpacity.value = withDelay(60, withTiming(0, { duration: 200 }));
        }, 400);
    }, [expandedUserPaused, playPauseIsPaused, playPauseOpacity, playPauseScale]);

    const playPausePillStyle = useAnimatedStyle(() => ({
        opacity: playPauseOpacity.value,
        transform: [{ scale: playPauseScale.value }],
    }));
    const playPausePlayGlyphStyle = useAnimatedStyle(() => ({
        opacity: playPauseIsPaused.value ? 1 : 0,
    }));
    const playPausePauseGlyphStyle = useAnimatedStyle(() => ({
        opacity: playPauseIsPaused.value ? 0 : 1,
    }));

    useEffect(() => {
        return () => {
            if (playPauseHoldTimerRef.current) clearTimeout(playPauseHoldTimerRef.current);
        };
    }, []);

    /**
     * Single tap while this card owns the fullscreen viewport toggles play/pause.
     *
     * This used to fall through to `handleFullscreen()`, which *collapsed* the card —
     * so a tap in fullscreen could never pause anything. Collapse now lives only on the
     * swipe-down dismiss pan.
     */
    const handleExpandedTapPause = useCallback(() => {
        const next = !expandedUserPaused;
        setExpandedUserPaused(next);
        playPauseIsPaused.value = next;
        try {
            if (next) feedVideoRef.current?.pause?.();
            else feedVideoRef.current?.resume?.();
        } catch {
            /* ColorOS ExoPlayer can already be released */
        }
        showPlayPausePill();
    }, [expandedUserPaused, feedVideoRef, playPauseIsPaused, showPlayPausePill]);

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

    const pendingMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelPendingMediaTap = useCallback(() => {
        if (pendingMuteTimerRef.current) {
            clearTimeout(pendingMuteTimerRef.current);
            pendingMuteTimerRef.current = null;
        }
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
            setPaused(true);
            try {
                feedVideoRef.current?.pause?.();
            } catch {
                /* ignore */
            }
            const scrolledToAnotherPost =
                storeActivePostId != null && String(storeActivePostId) !== String(post.id);
            if (scrolledToAnotherPost) {
                pendingSeekRef.current = null;
                waitingForResumeFrameRef.current = null;
                stickyResumeTimeRef.current = null;
                playbackTimeRef.current = 0;
                resetPosterCover();
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

    /** Carousel slides share one Video instance (keyed by post, not slide), so the
     *  resume/seek refs are component-level. Without this reset, swiping from one
     *  video slide to another makes onLoad seek the new video to the old slide's
     *  timestamp. Keyed on mediaUrl so a Scenes resume on the same slide is preserved. */
    const prevSlideUrlRef = useRef(mediaUrl);
    useEffect(() => {
        if (prevSlideUrlRef.current === mediaUrl) return;
        prevSlideUrlRef.current = mediaUrl;
        pendingSeekRef.current = null;
        playbackTimeRef.current = 0;
        stickyResumeTimeRef.current = null;
        waitingForResumeFrameRef.current = null;
    }, [mediaUrl]);

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

    /**
     * Full-screen expand.
     *
     * Only the card that owns the mounted player may expand (`slideMountVideo`),
     * which guarantees the thing we animate is the thing that is playing — no
     * second ExoPlayer, so nothing re-buffers and the ColorOS double-audio scar
     * cannot recur.
     *
     * The style is transform-only on purpose. Animating width/height would
     * re-lay-out the TextureView every frame, and this app has already seen a 1px
     * layout drift remount ExoPlayer (see `onFrameLayout`). Nothing here changes
     * layout, so `onLayout` never fires and the player is untouched.
     */
    const mediaCardRef = useRef<View>(null);
    const window = useWindowDimensions();
    /** Pixels of downward travel that map to a full collapse. */
    const dismissTravelPx = window.height * 0.55;
    // Body-scope twin of `slideMountVideo`, which is declared inside renderSlide
    // and so is not visible here. `isAudible` is the load-bearing term: it is
    // exactly the condition that keeps this card as the single mounted player.
    const canExpandCard =
        mode === 'feed' && Boolean(video) && isAudible && textureMountAllowed && !playFailed;
    const [expandTarget, setExpandTarget] = useState<FeedExpandTarget | null>(null);
    const isExpanding = expandTarget != null && expandTarget.postId === String(post.id);

    // Leaving fullscreen drops the user pause so the card rejoins the feed playing.
    // Keyed on `isExpanding` rather than `expandTarget` so it also clears when another
    // card takes over the viewport.
    useEffect(() => {
        if (!isExpanding) setExpandedUserPaused(false);
    }, [isExpanding]);

    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedExpand(setExpandTarget);
    }, [mode]);

    const expandProgress = getFeedExpandProgress();

    const expandCardRef = getFeedExpandCard();
    const expandScreenRef = getFeedExpandScreen();
    const expandTargetPostIdRef = getFeedExpandTargetPostId();
    // Captured as a plain string, not React state: the style must be able to
    // decide "am I the target?" without waiting for a commit, while still
    // ignoring the global mirrors when a sibling owns the morph.
    const expandPostId = String(post.id);

    /**
     * Reads the UI-thread mirrors, NOT `isExpanding`. There is deliberately no
     * React state in this closure: a worklet that captured component state would
     * not re-run until React re-rendered, which is precisely the freeze we are
     * removing. The morph is now startable from the tap worklet itself.
     */
    const expandAnimatedStyle = useAnimatedStyle((): ViewStyle => {
        // The mirrors are global, so every mounted card sees them. Bail unless
        // this card is the one being expanded, otherwise a tap would scale every
        // visible sibling to full screen and lift them all to zIndex 100.
        if (!isExpandTargetCard(expandPostId, expandTargetPostIdRef.value)) {
            return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
        }
        const card = expandCardRef.value;
        const screen = expandScreenRef.value;
        if (!card || !screen) {
            return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
        }
        const next = computeExpandTransform(expandProgress.value, card, screen);
        return {
            transform: [
                { translateX: next.translateX },
                { translateY: next.translateY },
                { scale: next.scale },
            ],
            // Lift above sibling cards. Android needs elevation as well as zIndex
            // for a view to paint over its neighbours.
            zIndex: 100,
            elevation: 100,
        };
    }, []);

    /**
     * JS-thread mirror of the module's cached rect, kept in sync after each
     * measure. Plain objects (not refs) so the gesture worklet can capture them;
     * `armAndExpandOnUIThread` re-validates them against the module's own cache
     * and the live scroll offset before using them.
     */
    const [expandCachedCard, setExpandCachedCard] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [expandCachedScreen, setExpandCachedScreen] = useState<{ width: number; height: number } | null>(null);

    /**
     * Measure + cache. Called ahead of the tap so the gesture worklet can arm
     * without a bridge round trip. `scrollYAtMeasure` stamps the rect; the
     * worklet refuses the fast path if the list has moved since.
     */
    const measureAndCache = useCallback(() => {
        const node = mediaCardRef.current;
        if (!node || typeof node.measureInWindow !== 'function') return;
        node.measureInWindow((x, y, w, h) => {
            if (w <= 0 || h <= 0) return;
            const rect = { x, y, width: w, height: h };
            const screen = { width: window.width, height: window.height };
            cacheFeedExpandCard(rect, screen, getFeedUiThreadScrollY());
            setExpandCachedCard(rect);
            setExpandCachedScreen(screen);
        });
    }, [window.height, window.width]);

    // Pre-measure whenever this card becomes the one holding the player, and
    // again after any re-layout. By tap time the rect is already on the UI
    // thread, so the morph can start inside the gesture worklet.
    useEffect(() => {
        if (!canExpandCard) return;
        measureAndCache();
    }, [canExpandCard, measureAndCache]);

    const beginExpand = useCallback(() => {
        const node = mediaCardRef.current;
        if (!node || typeof node.measureInWindow !== 'function') return;
        node.measureInWindow((x, y, w, h) => {
            if (!canExpandCard || w <= 0 || h <= 0) return;
            armFeedExpand({
                postId: String(post.id),
                card: { x, y, width: w, height: h },
                screen: { width: window.width, height: window.height },
            });
        });
    }, [canExpandCard, post.id, window.height, window.width]);

    const collapse = useCallback(() => {
        runFeedCollapseAnimation();
    }, []);

    // Only a card with the live player can expand, and only in the feed.

    const handleFullscreen = useCallback(() => {
        // Tapping an already-expanded card collapses it back to its feed position.
        if (isExpanding) {
            collapse();
            return;
        }
        // Only the card holding the mounted player expands. Anything else falls
        // through to the normal tap behaviour (navigating to the detail screen).
        if (canExpandCard) {
            beginExpand();
            return;
        }
        if (onPress && !onDoubleLike && !onSingleTap) {
            onPress();
            return;
        }
        onSingleTap?.();
    }, [beginExpand, canExpandCard, collapse, isExpanding, onDoubleLike, onPress, onSingleTap]);

    const handleDoubleLikeAt = useCallback(
        (localX?: number, localY?: number) => {
            fireBurstAt(width / 2, height / 2);
            onDoubleLike?.(localX, localY);
        },
        [fireBurstAt, height, onDoubleLike, width],
    );

    const handleMediaTapSingle = useCallback(
        (localX: number, localY: number) => {
            const tapX = Number.isFinite(localX) ? localX : 0;
            const tapY = Number.isFinite(localY) ? localY : 0;
            const frameW = width > 0 ? width : 1;
            const frameH = height > 0 ? height : frameW;
            if (tapY > frameH - 56 && (tapX > frameW - 56 || tapX < 160)) {
                return;
            }
            // Already fullscreen: the tap is a play/pause toggle, not a collapse.
            if (isExpanding) {
                handleExpandedTapPause();
                return;
            }
            handleFullscreen();
        },
        [handleExpandedTapPause, handleFullscreen, height, isExpanding, width],
    );

    /**
     * Swipe-down dismiss.
     *
     * Only mounted while expanded, and it drives the SAME progress shareable the
     * style reads, so the card tracks the finger 1:1 with no JS per frame. On
     * release, a short drag snaps back to full screen and a long one animates all
     * the way back to the card frame — the player is never detached either way.
     */
    const dismissPanGesture = useMemo(
        () =>
            isExpanding
                ? Gesture.Pan()
                      .activeOffsetY(12)
                      // Ignore mostly-horizontal drags so they still read as
                      // "nope" rather than hijacking a swipe.
                      .failOffsetX([-40, 40])
                      .onBegin(beginFeedExpandDrag)
                      .onUpdate((e: any) => {
                          'worklet';
                          dragFeedExpand(e.translationY || 0, dismissTravelPx);
                      })
                      .onEnd(() => {
                          'worklet';
                          // runFeedCollapseAnimation is a module import, so the
                          // worklet closure captures it safely.
                          if (endFeedExpandDrag()) runOnJS(runFeedCollapseAnimation)();
                      })
                : null,
        [dismissTravelPx, isExpanding],
    );

    /**
     * Worklet-safe mirrors. A `ref` cannot be read inside a worklet (the closure
     * would capture a snapshot), so the values the gesture needs live in plain
     * objects re-created on each render, which Reanimated re-captures for us.
     * (`expandPostId` is declared above, next to the animated style that also
     * needs it, so there is a single source for this render.)
     */
    const expandIsExpanding = { value: isExpanding };
    const expandFastPathEnabled = canExpandCard;

    const mediaTapGesture = useMemo(() => {
        const doubleTap = Gesture.Tap()
            .enabled(feedTapCapture)
            .numberOfTaps(2)
            .maxDuration(420)
            .maxDistance(36)
            .shouldCancelWhenOutside(false)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleDoubleLikeAt)(e.x, e.y);
            });
        const singleTap = Gesture.Tap()
            .enabled(feedTapCapture)
            .numberOfTaps(1)
            .maxDuration(420)
            .maxDistance(36)
            .shouldCancelWhenOutside(false)
            .requireExternalGestureToFail(doubleTap)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                // Fast path, entirely on the UI thread: arm the transform and
                // start the flight now, so the morph begins on the next frame
                // instead of after measureInWindow + a React commit. `runOnJS`
                // below is scheduled, so it cannot delay this.
                if (
                    expandFastPathEnabled &&
                    expandCachedCard != null &&
                    expandCachedScreen != null &&
                    !expandIsExpanding.value &&
                    armAndExpandOnUIThread(
                        expandPostId,
                        expandCachedCard,
                        expandCachedScreen,
                        getFeedUiThreadScrollY(),
                    )
                ) {
                    return;
                }
                runOnJS(handleMediaTapSingle)(e.x, e.y);
            });
        const taps = Gesture.Exclusive(doubleTap, singleTap);
        if (hasCarousel) {
            return Gesture.Simultaneous(Gesture.Native(), taps);
        }
        return taps;
    }, [
        canExpandCard,
        expandCachedCard,
        expandCachedScreen,
        expandPostId,
        feedTapCapture,
        handleDoubleLikeAt,
        handleMediaTapSingle,
        hasCarousel,
        isExpanding,
    ]);

    /**
     * Composed so the dismiss pan only exists while expanded. While collapsed the
     * vertical drag must reach the feed list, not a hidden pan recogniser — hence
     * this is not an `Gesture.Simultaneous` with an always-on pan.
     */
    const composedFeedMediaGesture = useMemo(
        () =>
            dismissPanGesture
                ? Gesture.Exclusive(dismissPanGesture, mediaTapGesture)
                : mediaTapGesture,
        [dismissPanGesture, mediaTapGesture],
    );


    const handleOpenScenesPress = useCallback(() => {
        onOpenScenes?.();
    }, [onOpenScenes]);

    useEffect(() => {
        const next = width > 0 ? width : windowSlideWidth;
        setPageWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
        if (!fillViewport && height > 0) {
            setPageHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
        }
    }, [fillViewport, height, width, windowSlideWidth]);

    const onFrameLayout = useCallback(
        (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
            // Parent already passed a locked square — 1px TextureView drift remounts ExoPlayer.
            if (!fillViewport && width > 1 && height > 1) return;
            const nextW = Math.round(e.nativeEvent.layout.width);
            const nextH = Math.round(e.nativeEvent.layout.height);
            if (nextW > 0) {
                setPageWidth((prev) => (Math.abs(prev - nextW) > 1 ? nextW : prev));
            }
            if (nextH > 0) {
                setPageHeight((prev) => (Math.abs(prev - nextH) > 1 ? nextH : prev));
            }
            // A re-layout invalidates the cached window-space rect the fast path
            // relies on, so re-measure. Width/height never change during the morph
            // itself (transform-only), so this cannot fire mid-transition.
            if (canExpandCard) measureAndCache();
        },
        [canExpandCard, fillViewport, height, measureAndCache, width],
    );

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
        // Flip ExoPlayer volume on the tap. The muted prop catches up on the next render.
        try {
            setAllFeedPlayerVolumes(0);
            if (nextSoundOn) {
                feedVideoRef.current?.setVolume?.(1);
                feedVideoRef.current?.resume?.();
            }
        } catch {
            /* player already released */
        }
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
    const isSquareFrame = height > 0 && width > 0 && Math.abs(height - width) < 8;
    // Feed videos always sit in a fixed 4:5 portrait box from FeedScreen — cover-crop
    // so landscape/square sources do not shrink the card (Stories-adjacent recycle).
    const mediaFit =
        mode === 'feed' && video
            ? 'cover'
            : isSquareFrame || !isLandscapeMedia
              ? 'cover'
              : 'contain';
    // Radius follows the card, not squareness: the video frame is a 4:5 portrait box
    // now, so `isSquareFrame` alone would strip the rounded corners off every video.
    const clipRadius = isSquareFrame || (mode === 'feed' && video) ? FEED_UI.media.videoRadius : 0;
    const frameBoxStyle = fillViewport
        ? {
              width: '100%' as const,
              height: '100%' as const,
              overflow: 'hidden' as const,
          }
        : {
              width: '100%' as const,
              // Fill the parent 4:5 box from FeedScreen — do not re-derive height here.
              height: mode === 'feed' && video ? ('100%' as const) : height,
              overflow: 'hidden' as const,
              borderRadius: clipRadius,
          };
    const frameStyle = frameBoxStyle;
    const slideBoxStyle = {
        width: slideWidth,
        height: fillViewport ? slideHeight : height,
        overflow: 'hidden' as const,
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
        const slideBoxH = fillViewport ? slideHeight : height;
        // ColorOS: only the settled audible postcard mounts a TextureView.
        // A second mounted player (warm / keep-alive) keeps playing under the next card.
        const slideMountVideo =
            slideVideo &&
            slideIsCurrent &&
            !playFailed &&
            hasValidVideoFrame(slideWidth, slideBoxH) &&
            (mode === 'detail' ||
                (mode === 'feed' && textureMountAllowed && isAudible));

        // Still images: never gated by video readiness — always fully opaque.
        if (!slideVideo) {
            const slideH = fillViewport ? slideHeight : height;
            return (
                <View style={styles.slideFill} collapsable={false}>
                    <Image
                        source={{ uri: slideUrl, width: slideWidth, height: slideH }}
                        style={{ width: slideWidth, height: slideH }}
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
        const onFirstFrameReady = () => {
            markUrlLoaded(slideRawUrl);
            fadeOutPosterCover();
        };
        const cachedVideoSource = buildFeedVideoSource(slideUrl, slideRawUrl);
        // Bluesky: play when this view is the single active one. Do not gate on a
        // React "scroll busy" flag — that stuck true and left the visible card silent
        // while a destroyed previous ExoPlayer kept leaking audio on ColorOS.
        const feedShouldPlay = mode === 'feed' && isAudible && feedPlaybackAllowed;
        // A user pause from a fullscreen tap overrides autoplay, and volume/repeat/mute
        // follow it so ExoPlayer is genuinely stopped rather than left looping silent.
        const videoShouldPlay = feedShouldPlay && !expandedUserPaused;

        return (
            <View style={styles.slideFill} collapsable={false}>
                {slideMountVideo ? (
                    <FeedPlayingVideo
                        key={String(post.id)}
                        remountEpoch={playerEpoch}
                        source={cachedVideoSource}
                        paused={mode === 'detail' ? paused : !videoShouldPlay}
                        muted={mode === 'feed' ? !videoShouldPlay || !soundOn : false}
                        volume={mode === 'detail' ? 1 : videoShouldPlay && soundOn ? 1 : 0}
                        repeat={mode === 'feed' && videoShouldPlay}
                        posterUri={slidePosterUri}
                        resizeMode={fillViewport ? 'contain' : mediaFit}
                        boxWidth={slideWidth}
                        boxHeight={fillViewport ? slideHeight : height}
                        clipRadius={fillViewport ? 0 : clipRadius}
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
                            // A player that remounted (focus/TextureView churn) starts from
                            // whatever the imperative blur cleanup left behind, so re-assert
                            // the visual mute state as soon as it reports ready.
                            syncFeedPlayerVolume();
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
                                }
                            }
                            if (mode !== 'feed') {
                                const ns = meta?.naturalSize;
                                if (ns && Number(ns.width) > 0 && Number(ns.height) > 0) {
                                    applyNaturalSize(Number(ns.width), Number(ns.height));
                                }
                            }
                        }}
                        onProgress={(e) => {
                            // ColorOS watchdog: if this card is not the audible slot OR the
                            // list is still scrolling, kill audio even when React props lag.
                            if (
                                mode === 'feed' &&
                                (getFeedScrollBusy() ||
                                    String(getActiveFeedVideoPostId()) !== String(post.id))
                            ) {
                                try {
                                    feedVideoRef.current?.setVolume?.(0);
                                    feedVideoRef.current?.pause?.();
                                } catch {
                                    /* ignore */
                                }
                                return;
                            }
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
                            } else if (t > 0.08 && Platform.OS !== 'android') {
                                // Android: ColorOS shows a black/half frame if we lift
                                // the still before onReadyForDisplay. Bluesky keeps the
                                // thumbnail up until the player reports ready.
                                onFirstFrameReady();
                            }
                            const now = Date.now();
                            if (now - lastHandoffAtRef.current >= 250) {
                                lastHandoffAtRef.current = now;
                                setFeedVideoHandoff(String(post.id), {
                                    currentTime: t,
                                    muted: !soundOn,
                                    mediaUrl: slideRawUrl,
                                });
                            }
                        }}
                        onError={(e) => onVideoError(slideRawUrl, e)}
                    />
                ) : null}

                {slidePosterUri ? (
                    <Animated.Image
                        source={{ uri: slidePosterUri }}
                        style={[styles.posterCover, { opacity: posterOpacity }]}
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
                    onScroll={onCarouselScroll}
                    onMomentumScrollEnd={onCarouselScrollEnd}
                    keyExtractor={(item, index) => `${post.id}-carousel-${index}-${item.url}`}
                    extraData={`${currentIndex}-${suspendNativeVideo}-${playerEpoch}`}
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
        <AnimatedFeedMediaCard
            ref={mediaCardRef}
            style={[styles.wrap, frameStyle, style, expandAnimatedStyle]}
            collapsable={false}
            onLayout={onFrameLayout}
            accessibilityRole={feedTapCapture ? 'button' : undefined}
            accessibilityLabel={feedTapCapture ? 'Double tap to like' : undefined}
        >
            {feedTapCapture ? (
                <GestureDetector gesture={composedFeedMediaGesture}>
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
                {/* Centre play/pause feedback for the fullscreen tap. The layer only
                    centres; the badge carries the animated opacity/scale so the
                    full-screen view itself is never transformed. */}
                <View style={styles.playPausePillLayer} pointerEvents="none">
                    <Reanimated.View style={[styles.playPausePill, playPausePillStyle]}>
                        <Reanimated.View style={[styles.playPauseGlyph, playPausePlayGlyphStyle]}>
                            <Icon name="play" size={30} color="#FFFFFF" />
                        </Reanimated.View>
                        <Reanimated.View style={[styles.playPauseGlyph, playPausePauseGlyphStyle]}>
                            <Icon name="pause" size={30} color="#FFFFFF" />
                        </Reanimated.View>
                    </Reanimated.View>
                </View>
            </View>
        </AnimatedFeedMediaCard>
    );

    return mediaCard;
    }),
    function feedPostMediaPropsAreEqual(prev: Props, next: Props) {
        const a = prev.post;
        const b = next.post;
        // Callback props (onPress / onSingleTap / onOpenScenes / …) are omitted on
        // purpose — FeedScreen recreates them often; media uses stable post fields +
        // remount keys for playback. Boolean() checks cover optional burst hooks only.
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
            prev.focusEpoch === next.focusEpoch &&
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
        position: 'relative',
    },
    mediaFrame: {
        width: '100%',
        alignSelf: 'stretch',
        overflow: 'hidden',
        position: 'relative',
    },
    videoClip: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
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
    playPausePillLayer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPausePill: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseGlyph: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
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
