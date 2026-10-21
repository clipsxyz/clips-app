import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import CachedImage from './CachedImage.native';
import Video, { type VideoRef } from 'react-native-video';
import {
    getActiveFeedVideoPostId,
    getFeedAudioFocusPostId,
    getFeedPreloadPostIds,
    subscribeActiveFeedVideo,
    subscribeFeedAudioFocusPostId,
    subscribeFeedPreloadPostIds,
} from '../utils/feedActiveVideoNative';
import {
    getFeedOverlayBlocksPlayback,
    subscribeFeedOverlayBlocksPlayback,
} from '../utils/feedOverlayStoreNative';
import { getFeedScrollPauseTarget, subscribeFeedScrollPauseTarget } from '../utils/feedScrollBusyNative';
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
import { resolvePostPlaybackUri } from '../utils/postMedia';
import {
    feedAspectRatio,
    feedCardAspectRatio,
    intrinsicRatio,
    resolveIntrinsicSize,
} from '../utils/mediaAspectRatio';
import { mediaItemsEqual } from '../utils/feedPostCompareNative';
import { normalizeHex } from '../utils/feedAmbientPalette';
import {
    MOCK_FEED_VIDEO_REMOTE_FALLBACK,
    isMockDemoVideoPath,
    isPlayableLocalMediaUri,
    mockFeedVideoSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import { FEED_CARD_MEDIA_SCRIM, FEED_CARD_MEDIA_TAP_LAYER } from './FeedPageLayout.native';
import LinearGradient from 'react-native-linear-gradient';
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

export function resolveFeedVideoPosterUri(
    item: PostMediaItem | undefined,
    post: Post,
): string | undefined {
    const extra = item as { posterUrl?: string; thumbnailUrl?: string; thumbnail_url?: string } | undefined;
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

/**
 * Horizontal displacement (points) a finger must actually travel before a carousel drag
 * counts as a swipe. Raw touch-down / pressure must not pause the playing clip.
 */
const CAROUSEL_DRAG_SLOP = 8;

/**
 * Warm stand-in painted behind a poster-less slide so a missing thumbnail cover reads as a
 * soft media surface instead of a hard black rectangle while the video warms up.
 */
const POSTER_FALLBACK_COLOR = '#241F1B';

/**
 * Neutral surface tint used when a post carries no usable `dominantColor` (or the bytes are
 * still in flight). Deliberately a lifted charcoal, not the `#241F1B` void: an un-warmed
 * card should read as "media is coming", not as a dead black hole.
 */
const MEDIA_PLACEHOLDER_NEUTRAL = '#2E3138';

type FeedNativeVideoProps = {
    /** Full remount key: identity + slide + epoch. A change here MUST rebuild the player. */
    videoKey: string;
    postId: string;
    source: object;
    /** Base playback gate from the card (viewability / carousel hold / overlay hold). The
     *  feed drag gate is folded in inside the component so only this leaf re-renders for it. */
    paused: boolean;
    muted: boolean;
    soundOn: boolean;
    repeat: boolean;
    mode: 'feed' | 'detail';
    /** Landscape frames use `contain` (letterboxed, never side-cropped); portrait uses `cover`. */
    resizeMode?: 'cover' | 'contain';
    isViewable: boolean;
    videoRef: React.Ref<VideoRef>;
    onLoadStart: React.ComponentProps<typeof Video>['onLoadStart'];
    onReadyForDisplay: React.ComponentProps<typeof Video>['onReadyForDisplay'];
    onLoad: React.ComponentProps<typeof Video>['onLoad'];
    onProgress: React.ComponentProps<typeof Video>['onProgress'];
    onError: React.ComponentProps<typeof Video>['onError'];
};

/**
 * The native ExoPlayer/TextureView, fenced behind a memo boundary that ONLY breaks when a
 * prop the PLAYER actually depends on changes (identity/url/epoch/playback state).
 *
 * Every like, burst, sticker, caption, or engagement update re-renders FeedPostMedia and
 * hands this component a brand-new `post` object plus fresh handler closures. A default
 * memo would flap on those identities and reconcile the native <Video>, which on Android
 * tears the TextureView down mid-playback. This comparator deliberately ignores:
 *   - the `post` object identity (only `postId` matters),
 *   - like/likeCount and any engagement state (never reaches here at all),
 *   - overlay/animation identities (opacity, posters, bursts),
 *   - handler closure identity (all handlers read stable refs / callbacks).
 * Handlers can therefore stay stale for the lifetime of a compared render — safe because
 * they only close over refs, setters, and the `slideRawUrl` this instance was built for.
 */
const FeedNativeVideo = React.memo(function FeedNativeVideo({
    videoKey,
    postId,
    source,
    paused,
    muted,
    soundOn,
    repeat,
    mode,
    resizeMode = 'cover',
    videoRef,
    onLoadStart,
    onReadyForDisplay,
    onLoad,
    onProgress,
    onError,
}: FeedNativeVideoProps) {
    /**
     * Feed drag gate. It lives HERE rather than in `FeedPostMedia` because it only feeds
     * `paused`; subscribing in the parent made every mounted card re-render (carousel
     * memos, scrims, overlays, tap layer) on the exact frame the finger starts moving — a
     * dropped frame that read as a micro-pause at drag start.
     *
     * The gate is scoped, not global: the store publishes the post id of the one card the
     * feed is currently playing, so this subscriber is the ONLY one that sees a change.
     * Every other mounted leaf is handed a foreign id and keeps `false`, which is a
     * same-value setState React bails out of — no render, no native prop write.
     *
     * Kept out of `isViewable` on purpose — that flag also drives `slideMountVideo`, so
     * folding scroll state into it would tear the TextureView down every gesture.
     */
    const [scrollPaused, setScrollPaused] = useState<boolean>(
        () => mode === 'feed' && getFeedScrollPauseTarget() === postId,
    );
    useEffect(() => {
        if (mode !== 'feed') return undefined;
        return subscribeFeedScrollPauseTarget((targetPostId) => {
            setScrollPaused(targetPostId !== null && targetPostId === postId);
        });
    }, [mode, postId]);

    /**
     * The hold is applied in the same tick as the list event — no animation-frame deferral.
     *
     * The gate can only trip once the list has already travelled past the touch slop, so by
     * then the native pan has long since won its frame and there is nothing left to yield.
     * Deferring the hold bought nothing there, but it made the RELEASE late: the resume was
     * queued behind a frame that a saturated UI thread can block for ~200ms (measured), so
     * a short drag left the player held for a full second after the finger had lifted.
     * Both directions are synchronous now; the scoped subscription keeps the work to a
     * single leaf, which is what made that affordable.
     */
    return (
        <Video
            key={videoKey}
            ref={videoRef}
            source={source}
            style={styles.videoFill}
            resizeMode={resizeMode}
            controls={false}
            paused={paused || (mode === 'feed' && scrollPaused)}
            muted={muted}
            volume={mode === 'detail' ? 1 : soundOn ? 1 : 0}
            repeat={repeat}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            useTextureView
            hideShutterView
            shutterColor="transparent"
            progressUpdateInterval={100}
            {...androidListSafeVideoProps()}
            pointerEvents="none"
            onLoadStart={onLoadStart}
            onReadyForDisplay={onReadyForDisplay}
            onLoad={onLoad}
            onProgress={onProgress}
            onError={onError}
        />
    );
},
(prev, next) =>
    // The entire player identity + playback contract. Everything else is noise.
    prev.postId === next.postId &&
    prev.videoKey === next.videoKey &&
    prev.source === next.source &&
    prev.paused === next.paused &&
    prev.muted === next.muted &&
    prev.soundOn === next.soundOn &&
    prev.repeat === next.repeat &&
    prev.mode === next.mode &&
    prev.resizeMode === next.resizeMode &&
    prev.isViewable === next.isViewable,
);

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
    /** Feed: single-tap opens fullscreen (Scenes for video, still viewer for images). */
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
    /**
     * Feed only: keep the native Video surface mounted but paused while a full-screen
     * viewer route (Scenes / ImageFullscreen) covers the feed. Prevents the ExoPlayer
     * teardown+realloc that would otherwise cause the MP4 to restart from 0 on return.
     */
    holdNativeVideo?: boolean;
    /** Feed autoplay is muted by default (global mute pref). */
    muted?: boolean;
    /**
     * Skip the feed poster-cover (opacity 0 TextureView). Required in post viewers /
     * profile sheets where an opacity-0 surface plays audio but never composites.
     */
    immediateVideoSurface?: boolean;
    style?: StyleProp<ViewStyle>;
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
        holdNativeVideo = false,
        muted = true,
        immediateVideoSurface = false,
        style,
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
    const posterOpacity = useRef(new Animated.Value(1)).current;
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const mediaRevealRef = useRef<Animated.CompositeAnimation | null>(null);
    /**
     * Every poster bitmap that has already painted, by URI. A per-URI SET (not a single
     * ref) so a slide that decoded its poster while it was still non-current is remembered
     * the moment it becomes current — a single "last painted" ref lost that and left the
     * cover opaque over items 2+ of a carousel.
     */
    const paintedPosterUrisRef = useRef<Set<string>>(new Set());
    /**
     * Whether the CURRENT slide's poster bitmap is already on screen. Drives the pending
     * overlay only — never layout. Seeded from `paintedPosterUrisRef` on every hold-key
     * change so a warm card (or a re-swiped carousel page) never flashes the spinner.
     */
    const [posterPaintedForSlide, setPosterPaintedForSlide] = useState(false);
    /**
     * Placeholder tint for an un-warmed card. `dominantColor` is sampled server-side from the
     * poster/first still (`api/posts.ts`) and validated here by `normalizeHex`. When the post
     * carries none, a lifted neutral surface stands in so the card never reads as a black void.
     */
    const placeholderColor = useMemo(
        () => normalizeHex(post.dominantColor) ?? MEDIA_PLACEHOLDER_NEUTRAL,
        [post.dominantColor],
    );
    /** onReadyForDisplay fired for the current hold. Reset when the hold key changes. */
    const firstFrameReadyRef = useRef(false);
    /**
     * Android only: playback position has actually advanced since this hold began.
     *
     * `onReadyForDisplay` maps to ExoPlayer `STATE_READY` (buffers loaded), which can fire a
     * few frames BEFORE the first frame is composited onto the TextureView. Fading the poster
     * on it therefore exposed the unpainted surface as a black flash. The progress handler is
     * only restarted in STATE_READY and cleared in STATE_BUFFERING, so a tick with a non-zero
     * position proves the decoder is rendering. iOS `onReadyForDisplay` is
     * `AVPlayerLayer.isReadyForDisplay` (first frame present), so it needs no extra gate.
     */
    const progressReadyRef = useRef(false);
    /** Opaque poster (or the black mask, when there is no thumbnail) is in this frame. */
    const posterCoveringRef = useRef(true);
    /**
     * Whether THIS card is allowed to reveal its video over the poster — i.e. it owns the
     * decoder or the live audio focus. A silent preload neighbor keeps the poster 100% opaque
     * even once its surface is warm, so pre-warming can never show a frozen first frame.
     */
    const posterRevealAllowedRef = useRef(false);
    /** Feed autoplay target from FlatList viewability (store). */
    const [storeActivePostId, setStoreActivePostId] = useState<string | null>(() =>
        getActiveFeedVideoPostId(),
    );
    /**
     * Live audio/playback focus (top-most video in the viewport). Updated on every
     * viewability pass, including mid-fling — unlike `storeActivePostId` which only moves
     * at settle. Drives pause/mute so the outgoing card is cut instantly.
     */
    const [storeAudioFocusPostId, setStoreAudioFocusPostId] = useState<string | null>(() =>
        getFeedAudioFocusPostId(),
    );
    /**
     * Adjacent cards the feed is silently pre-warming (next neighbor only). A preload id may
     * only MOUNT a paused, muted surface — it never claims audio focus or the decoder owner.
     */
    const [storePreloadPostIds, setStorePreloadPostIds] = useState<string[]>(() =>
        getFeedPreloadPostIds(),
    );
    /**
     * Intrinsic width/height measured at runtime, from RNV `naturalSize` (video) or
     * `source` (image). Null until the first load. This replaces the old
     * `isLandscapeMedia` boolean: that flag could only choose between 4:5 and 16:9, so
     * a 9:16 clip and a 4:3 clip were indistinguishable and both got the wrong box.
     */
    const [measuredSize, setMeasuredSize] = useState<{
        slideIndex: number;
        width: number;
        height: number;
    } | null>(null);

    const fadeOutPosterCover = useCallback(() => {
        if (!firstFrameReadyRef.current || !posterCoveringRef.current) return;
        // A silent preload neighbor keeps its poster opaque until it becomes the primary
        // player, so warming the surface never shows a frozen first frame.
        if (!posterRevealAllowedRef.current) return;
        // Android feed: wait for playback to actually advance before lifting the cover —
        // STATE_READY can precede the first composited frame (see progressReadyRef).
        // Detail / post-viewer must not wait: an opacity-0 TextureView never composites
        // on some OEMs, so onReadyForDisplay/progress never fire and audio plays over a blank frame.
        if (!immediateVideoSurface && mode !== 'detail' && Platform.OS === 'android' && !progressReadyRef.current) return;
        setVideoSurfaceReady((prev) => {
            if (prev) return prev;
            mediaRevealRef.current?.stop();
            // Only the video top layer animates in. The poster stays fully opaque as the
            // base layer, and the video surface is transparent until ExoPlayer paints its
            // first frame — so even a fade that starts before the first composited frame
            // reveals nothing but the poster underneath (no void flash).
            mediaRevealRef.current = Animated.timing(videoOpacity, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            });
            mediaRevealRef.current.start(() => {
                mediaRevealRef.current = null;
            });
            return true;
        });
    }, [immediateVideoSurface, mode, videoOpacity]);

    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeActiveFeedVideo(setStoreActivePostId);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedAudioFocusPostId(setStoreAudioFocusPostId);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedPreloadPostIds(setStorePreloadPostIds);
    }, [mode]);

    const [overlayBlocksPlayback, setOverlayBlocksPlayback] = useState(() =>
        mode === 'feed' ? getFeedOverlayBlocksPlayback() : false,
    );
    useEffect(() => {
        if (mode !== 'feed') return;
        return subscribeFeedOverlayBlocksPlayback(setOverlayBlocksPlayback);
    }, [mode]);
    // Comments sheet (and other overlay-store blocks) must unmount TextureViews without
    // FeedScreen setState / extraData — this cell subscribes directly.
    const videoSuspended = suspendNativeVideo || overlayBlocksPlayback;

    /**
     * Profile / peek / post-detail viewers pass `isActive` because they are not the
     * feed FlatList. Honor it so the TextureView mounts and the poster cover can lift
     * even when the feed store still points at a different card.
     */
    const propIsActive = Boolean(isActive) && !videoSuspended;
    /** Settled decoder owner — drives surface MOUNT/teardown, frozen during a fling. */
    const isViewable =
        mode === 'feed' &&
        !videoSuspended &&
        (String(storeActivePostId) === String(post.id) || propIsActive);
    /** Live playback owner — drives pause/mute so audio focus follows the viewport. */
    const isAudioPrimary =
        !videoSuspended &&
        (mode === 'detail' ||
            (mode === 'feed' &&
                ((storeAudioFocusPostId != null &&
                    String(storeAudioFocusPostId) === String(post.id)) ||
                    propIsActive)));
    // Only the audio-primary card actually plays.
    const isFeedAutoplayActive = isAudioPrimary;
    // Feed-only: hold the native surface mounted (paused) while a viewer route covers us.
    const feedVideoHeld = mode === 'feed' && holdNativeVideo;
    /**
     * Whether this card's native surface should exist. UNION of the settled decoder owner
     * and the live audio focus: the audio signal can only MOUNT the incoming card early, it
     * never removes the settled card (`isViewable`) mid-fling — so no premature TextureView
     * teardown. Exactly one card is `isAudioPrimary`, so at most one ever plays.
     */
    const feedSurfaceMounted = isViewable || isAudioPrimary;
    /**
     * Silent preload neighbor: mount a paused, muted surface EARLY so the codec alloc,
     * container parse and first-segment fetch happen off-primary and settling on this card
     * plays instantly. Mount-only — it never claims audio focus (see `paused`/`muted` below).
     */
    const isPreloadNeighbor =
        mode === 'feed' &&
        !videoSuspended &&
        !feedSurfaceMounted &&
        storePreloadPostIds.includes(String(post.id));
    /**
     * Whether the native surface should exist at all: the settled decoder owner, the live
     * audio focus, or a silent preload neighbor. The first two may PLAY; the third only warms.
     */
    const feedVideoMounted = feedSurfaceMounted || isPreloadNeighbor;
    /**
     * The poster may only be lifted for the card that is actually the player. A silent
     * preload keeps its poster 100% opaque even after its surface is warm — the reveal is
     * gated on `isAudioPrimary` alone (not `isViewable`), so a warmed-but-not-yet-primary
     * neighbor can never show a frozen first frame.
     */
    posterRevealAllowedRef.current = isAudioPrimary;

    // Reveal the warmed poster -> video swap the instant this card becomes the player.
    // A preload neighbor's surface is already prepared, so unmuting + lifting the poster
    // happen together with no re-create / re-buffer and no frozen frame (readiness is still
    // gated inside `fadeOutPosterCover`: the poster stays opaque until the video is
    // advancing). Detail / profile viewers use the same path so audio cannot run under
    // an opaque cover.
    useEffect(() => {
        if (!isAudioPrimary) return;
        fadeOutPosterCover();
    }, [isAudioPrimary, fadeOutPosterCover]);

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
        // Only a measurement taken for THIS slide may size this slide: a recycled
        // carousel page must never inherit the previous slide's dimensions.
        measured:
            measuredSize && measuredSize.slideIndex === currentIndex ? measuredSize : null,
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
     * Report a runtime-measured size (RNV `naturalSize`, image `source`).
     *
     * In feed mode the wrapper owns the box, so hand the measurement straight to it:
     * the wrapper now adopts it immediately (live state, not a frozen snapshot) and
     * re-renders this card at the corrected height in the same commit. Everywhere else
     * (detail/ad, or a feed card with no external height) the local size drives the box,
     * tagged with the slide it was measured on.
     */
    const reportMeasuredSize = useCallback(
        (size: { width: number; height: number }) => {
            if (intrinsicRatio(size.width, size.height) == null) return;
            if (mode === 'feed' && height > 0) {
                onIntrinsicSize?.(size);
                return;
            }
            setMeasuredSize({ slideIndex: currentIndex, ...size });
        },
        [mode, height, onIntrinsicSize, currentIndex],
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

    /**
     * Mirror of `currentIndex` so high-frequency onScroll events read a stable value
     * instead of a closure that lags a render behind (which would re-fire the
     * setState/parent emit).
     */
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;
    /**
     * Horizontal carousel drag in progress. Only the slide we STARTED on is held paused
     * (see `carouselDragFromIndexRef`) so the outgoing clip's audio cuts, while the target
     * slide — mounted the moment the index crosses — still decodes and plays. The hold is
     * armed only after the finger travels past `CAROUSEL_DRAG_SLOP`, so resting a finger or
     * light pressure never pauses the playing clip.
     */
    const [isCarouselDragging, setIsCarouselDragging] = useState(false);
    const carouselDragFromIndexRef = useRef<number | null>(null);
    const carouselDragOriginXRef = useRef<number | null>(null);
    const carouselDragMovedRef = useRef(false);

    /**
     * Sync the paging index from a raw horizontal offset. Runs on EVERY onScroll (throttled
     * to 16ms) as well as momentum-end, so the target slide's <Video> mounts and begins
     * decoding as soon as the gesture crosses the page midpoint — no trailing timer, no
     * waiting for the fling to fully settle. The ref guard makes it fire once per crossing.
     */
    const applyCarouselIndex = useCallback(
        (offsetX: number) => {
            if (!hasCarousel || !width) return;
            const next = Math.round(offsetX / width);
            const clamped = Math.max(0, Math.min(next, maxCarouselIndex));
            if (clamped === currentIndexRef.current) return;
            currentIndexRef.current = clamped;
            lastEmittedIndexRef.current = clamped;
            setCurrentIndex(clamped);
            // Outgoing slide is unmounting — release the drag-hold so the target isn't paused.
            setIsCarouselDragging(false);
            requestAnimationFrame(() => onCarouselIndexChange?.(clamped));
        },
        [hasCarousel, maxCarouselIndex, onCarouselIndexChange, width],
    );

    const onCarouselScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const origin = carouselDragOriginXRef.current;
            if (!carouselDragMovedRef.current && origin != null && Math.abs(offsetX - origin) >= CAROUSEL_DRAG_SLOP) {
                // The finger has actually swiped — now (and only now) hold the from-slide.
                carouselDragMovedRef.current = true;
                if (carouselDragFromIndexRef.current != null) {
                    setIsCarouselDragging(true);
                }
            }
            applyCarouselIndex(offsetX);
        },
        [applyCarouselIndex],
    );

    const onCarouselScrollBeginDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        carouselDragFromIndexRef.current = currentIndexRef.current;
        carouselDragOriginXRef.current = e.nativeEvent.contentOffset.x;
        carouselDragMovedRef.current = false;
    }, []);

    const onCarouselScrollEndDrag = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const moved = carouselDragMovedRef.current;
            carouselDragOriginXRef.current = null;
            carouselDragMovedRef.current = false;
            if (!moved) {
                setIsCarouselDragging(false);
                return;
            }
            // No momentum follows (vx ~ 0) — release now so a snap-back resumes playback.
            // A fling keeps the hold until momentum-end or the index crossing clears it.
            const vx = e.nativeEvent.velocity?.x;
            if (vx === undefined || Math.abs(vx) < 0.1) setIsCarouselDragging(false);
        },
        [],
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
    const activePosterUri = resolveFeedVideoPosterUri(
        activeItem as PostMediaItem | undefined,
        post,
    );
    /**
     * Identity of the frame that must be masked. Compared during render so the poster
     * snaps back to opaque in the same commit that mounts the TextureView — an effect
     * runs after paint and leaves one black frame.
     */
    // Keyed on the UNION of mount owners (`feedVideoMounted`), not `isViewable` alone: since
    // the live audio focus OR a silent preload can mount this card early, the mask identity
    // must already be "mounted" so the later settle (isViewable 0→1) and the preload→primary
    // flip do NOT change the key and re-cover an already-painted/warmed first frame.
    const posterHoldKey = `${post.id}|${mediaUrl ?? ''}|${currentIndex}|${feedVideoMounted ? 1 : 0}|${videoSuspended ? 1 : 0}|${playerEpoch}`;
    const [appliedPosterHoldKey, setAppliedPosterHoldKey] = useState('');
    const activePosterUriRef = useRef<string | null>(activePosterUri ?? null);
    activePosterUriRef.current = activePosterUri ?? null;
    if (video && appliedPosterHoldKey !== posterHoldKey) {
        // "Cover already painted" is decided purely by whether THIS slide's poster URI has
        // ever decoded. The cover element now stays mounted for the life of the card, so a
        // previously decoded slide keeps its bitmap resident and a re-swipe reuses it.
        const coverAlreadyPainted = !!activePosterUri && paintedPosterUrisRef.current.has(activePosterUri);
        mediaRevealRef.current?.stop();
        mediaRevealRef.current = null;
        setAppliedPosterHoldKey(posterHoldKey);
        if (mode === 'detail' || immediateVideoSurface) {
            // Post viewer: keep the TextureView fully opaque. Hiding it at opacity 0
            // (feed anti-flash) leaves audio playing over a blank frame on Android.
            firstFrameReadyRef.current = true;
            progressReadyRef.current = true;
            posterCoveringRef.current = false;
            posterRevealAllowedRef.current = true;
            videoOpacity.setValue(1);
            setVideoSurfaceReady(true);
            setPosterPaintedForSlide(true);
        } else {
            firstFrameReadyRef.current = false;
            progressReadyRef.current = false;
            posterCoveringRef.current = coverAlreadyPainted || !activePosterUri;
            posterOpacity.setValue(1);
            videoOpacity.setValue(0);
            setVideoSurfaceReady(false);
            // Seed the pending-overlay flag from the resident bitmaps: a poster that already
            // decoded keeps suppressing the spinner across the re-mount / re-swipe.
            setPosterPaintedForSlide(coverAlreadyPainted);
        }
    }

    useEffect(() => {
        if (videoSuspended) {
            needsRemountAfterSuspendRef.current = true;
        }
    }, [videoSuspended]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        if (!isFeedAutoplayActive || videoSuspended) return;
        if (!needsRemountAfterSuspendRef.current) return;
        needsRemountAfterSuspendRef.current = false;
        setPlayerEpoch((n) => n + 1);
        setPaused(false);
        setPlayFailed(false);
    }, [isFeedAutoplayActive, mode, videoSuspended, video]);

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
        if (isFeedAutoplayActive && !videoSuspended) {
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
                player?.seek?.(0);
            }
        } catch {
            /* ignore */
        }
    }, [
        isFeedAutoplayActive,
        mode,
        post.id,
        storeActivePostId,
        videoSuspended,
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
        // `maxDistance` is essential for scroll pass-through: RNGH's native tap default is an
        // unlimited max distance, so a finger that holds still for a beat then drags keeps the
        // tap in BEGAN (no fail on movement) and the parent list pan waits for it to resolve.
        // Failing fast once the finger travels past the touch slop hands the gesture straight to
        // the feed's vertical pan with no perceptible lag. Both taps need it — the composition is
        // Simultaneous, so the touch stays held while *either* recognizer is still BEGAN.
        const doubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(400)
            .maxDelay(300)
            .maxDistance(10)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleLikeAt)(e.x, e.y);
            });
        const singleTap = Gesture.Tap()
            .numberOfTaps(1)
            .maxDuration(250)
            .maxDistance(10)
            .onEnd((_e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(handleFullscreen)();
            });
        // `Gesture.Exclusive` is implemented as singleTap.requireExternalGestureToFail(doubleTap)
        // (gestureComposition.ts:98-118), so the single tap was gated behind the double tap's
        // ~300ms maxDelay — the full-screen open felt laggy. Simultaneous() drops that
        // dependency: the single tap resolves on release at 0ms, which is the priority.
        // Deliberate trade-off: a double tap's FIRST tap opens the viewer, so the feed never
        // sees the second tap — the double-tap like therefore lives on the opened viewer
        // (Scenes for video; the still viewer now has the same parity). Do not reintroduce
        // Exclusive here: it is exactly the delay we removed.
        const combined = Gesture.Simultaneous(doubleTap, singleTap);
        if (hasCarousel) {
            return Gesture.Simultaneous(Gesture.Native(), combined);
        }
        return combined;
    }, [handleFullscreen, handleLikeAt, hasCarousel]);

    useEffect(
        () => () => {
            if (clearBurstTimerRef.current) {
                clearTimeout(clearBurstTimerRef.current);
            }
        },
        [],
    );

    const renderFeedTapOverlay = () => {
        // Non-carousel: dedicated tap surface (Image/Video steal touches on Android).
        // Carousel: GestureDetector wraps the ScrollView instead (see return).
        //
        // Rendered EXACTLY ONCE per card, as a sibling of `mediaBody` at the end of the card
        // root (not inside the media frame). Nesting a second copy inside `renderSlide` made
        // two GestureDetectors wrap the same `mediaTapGesture`; the RNGH orchestrator collects
        // handlers from every view under the pointer, so touch-down ran `begin()` (→ STATE_BEGAN)
        // and dispatched a state-change event for FOUR tap handlers instead of two — pure
        // native overhead on the exact frame the list needs to start tracking the pan, with the
        // topmost (root) copy already receiving the touch. Keep this to one call site.
        if (!feedTapCapture || hasCarousel) return null;
        return (
            <GestureDetector gesture={mediaTapGesture}>
                {/* Plain View, not Pressable: a Pressable claims the JS responder on touch-down
                    (setJSResponder + blockNativeResponder), which makes the UI thread hold the
                    touch for a JS round-trip and delays the feed's native pan. The View is still a
                    reliable native hit target for the detector (the 1% background keeps Android
                    from skipping it), but leaves the touch stream to the list scroll. */}
                <View
                    style={FEED_CARD_MEDIA_TAP_LAYER}
                    collapsable={false}
                    accessibilityRole="button"
                    accessibilityLabel="Tap for fullscreen, double tap to like"
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
     * Subtle "media is coming" overlay. Shown only when the video surface is actually mounted
     * for this card AND neither layer can paint yet: the poster bitmap has not arrived and the
     * video has not reached its first frame. It never participates in layout (absolute fill)
     * and never renders for a warm card, because `posterPaintedForSlide` is seeded from the
     * resident bitmaps on every hold-key change.
     */
    const videoSurfaceMounted =
        video &&
        !playFailed &&
        (mode === 'detail' ||
            (mode === 'feed' && !videoSuspended && (feedSurfaceMounted || feedVideoHeld)));
    const showMediaPendingOverlay =
        videoSurfaceMounted && !videoSurfaceReady && !posterPaintedForSlide;

    /**
     * The ratio we actually render at: content-first, clamped only at the policy
     * extremes. In feed mode the wrapper has already turned this into a concrete box and
     * passed it down, so the frame adopts it verbatim; other callers may pass a token
     * height and still get a sane clamp instead of an unstretched box.
     */
    const intrinsicWidth = effectiveSize?.width;
    const intrinsicHeight = effectiveSize?.height;
    // Feed cards use the card ratio (true landscape, neutral 16:9 unknown) so this
    // frame's own math agrees with the wrapper's `fitLandscape` height; other modes
    // keep the shared 16:9-capped clamp.
    const targetRatio =
        mode === 'feed'
            ? feedCardAspectRatio(intrinsicWidth, intrinsicHeight)
            : feedAspectRatio(intrinsicWidth, intrinsicHeight);
    const contentHeight =
        width > 0 ? Math.round(width / targetRatio) : height > 0 ? height : 0;
    // In feed mode the WRAPPER owns the height. It resolves the intrinsic size (payload
    // dims first, then the module-scope measurement cache) and passes the final height
    // down. The frame fills exactly that box so the inner poster/video surface and the
    // outer container are sized from a single value and therefore can never disagree.
    //
    // This is what removes the mount pop: previously the inner frame independently
    // shrank to `min(contentHeight, height)` the instant ExoPlayer reported `naturalSize`
    // — one render BEFORE the wrapper learned the same measurement through an effect. For
    // that frame the media sat in a shorter box than the wrapper, leaving a black gap,
    // and the wrapper then caught up and reflowed. Tying the frame to the wrapper means
    // both change in the same commit, so there is no gap and no post-mount correction.
    //
    // Other modes (detail/ad) keep the clamp: their caller passes a fixed box and a
    // landscape clip must not overflow it.
    const frameHeight =
        mode === 'feed' && height > 0
            ? height
            : height > 0
              ? Math.min(contentHeight, height)
              : contentHeight;
    const viewerSurface = mode === 'detail' || immediateVideoSurface;
    const frameStyle = {
        width,
        height: frameHeight,
        backgroundColor: viewerSurface ? '#000000' : placeholderColor,
        overflow: (viewerSurface ? 'visible' : 'hidden') as 'visible' | 'hidden',
        borderRadius: viewerSurface ? 0 : 20,
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
        // Per-slide scaling: landscape frames letterbox (`contain`) so a widescreen
        // clip is never side-cropped when the box and the frame disagree (viewport
        // cap, late measurement); portrait/square fill (`cover`) per feed policy.
        // The current slide may use the measured size; sibling slides use their own
        // payload dimensions so a neighbour's orientation never leaks across pages.
        const slideSize =
            slideIsCurrent && effectiveSize
                ? effectiveSize
                : (() => {
                      const w = Number(item?.width ?? post.width);
                      const h = Number(item?.height ?? post.height);
                      return intrinsicRatio(w, h) != null ? { width: w, height: h } : null;
                  })();
        const slideRatio = intrinsicRatio(slideSize?.width, slideSize?.height);
        const slideResizeMode: 'cover' | 'contain' =
            slideRatio != null && slideRatio > 1 ? 'contain' : 'cover';
        // Hold ONLY the slide the horizontal drag started on so the outgoing clip's audio
        // cuts the instant the finger swipes, while the target (a different slideIndex) is
        // never held.
        const slideDragHeld = isCarouselDragging && slideIndex === carouselDragFromIndexRef.current;
        // Mount the native TextureView for the ACTIVE slide only. Pre-mounting every slide's
        // surface made Android composite a neighbouring TextureView into the active page
        // (two slides visible side-by-side). One surface at a time keeps the card clean.
        // Mount for the settled owner OR the live audio focus (so the incoming card can
        // start playing during a fling) OR a silent preload neighbor (warmed ahead of time)
        // OR while held for a viewer. The audio-focus / preload terms are additive only —
        // they can mount the incoming card early but never unmount the settled card, which
        // stays until `isViewable` clears at settle.
        const slideMountVideo =
            slideVideo &&
            slideIsCurrent &&
            !playFailed &&
            (mode === 'detail' ||
                (mode === 'feed' && !videoSuspended && (feedVideoMounted || feedVideoHeld)));
        // Still images: never gated by video readiness — always fully opaque.
        if (!slideVideo) {
            return (
                <View style={[styles.mediaFrame, frameStyle]} collapsable={false}>
                    <CachedImage
                        source={{ uri: slideUrl }}
                        style={styles.stillImage}
                        resizeMode={slideResizeMode}
                        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                        progressiveRenderingEnabled={false}
                        pointerEvents={mediaPointerEvents}
                        onLoadStart={() => beginUrlLoad(slideRawUrl)}
                        onLoad={(e) => {
                            markUrlLoaded(slideRawUrl);
                            if (!slideIsCurrent) return;
                            const src = e.nativeEvent.source;
                            if (src) {
                                reportMeasuredSize({
                                    width: Number(src.width),
                                    height: Number(src.height),
                                });
                            }
                        }}
                        onError={() => markUrlLoaded(slideRawUrl)}
                    />
                </View>
            );
        }

        // OnReadyForDisplay is the ONLY signal that pixels are actually on the surface.
        // onLoad (stream prepared) can happen well before the first frame is composited;
        // fading the poster on it exposed a black TextureView until the decoder painted.
        const onFirstFrameReady = () => {
            if (!slideIsCurrent) return;
            markUrlLoaded(slideRawUrl);
            firstFrameReadyRef.current = true;
            fadeOutPosterCover();
        };
        const cachedVideoSource = buildFeedVideoSource(slideUrl, slideRawUrl);

        const viewerSurface = mode === 'detail' || immediateVideoSurface;
        const slideFrameStyle = viewerSurface
            ? [styles.viewerFrame, frameStyle]
            : [styles.mediaFrame, frameStyle];

        return (
            <View style={slideFrameStyle} collapsable={false}>
                <Animated.View
                    style={[
                        styles.posterCover,
                        // Base layer. Opaque tint (not transparent) so the cover holds a
                        // surface colour while the poster bytes decode and when there is no
                        // poster at all. The video top layer fades in above it, so this never
                        // has to be lifted mid-mount.
                        { backgroundColor: placeholderColor },
                        { opacity: slideMountVideo ? posterOpacity : 1 },
                    ]}
                    pointerEvents="none"
                    collapsable={false}
                >
                    {slidePosterUri ? (
                        <Animated.Image
                            source={{ uri: slidePosterUri, cache: 'force-cache' }}
                            style={StyleSheet.absoluteFill}
                            resizeMode={slideResizeMode}
                            resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                            fadeDuration={0}
                            onLoad={() => {
                                // Record the paint for EVERY slide, including non-current
                                // ones. A neighbouring slide's poster decodes while the
                                // carousel is still on another page; if we skipped it here
                                // the per-URI set stayed empty and the cover never lifted
                                // once that page became current.
                                paintedPosterUrisRef.current.add(slidePosterUri);
                                if (!slideIsCurrent) return;
                                if (slidePosterUri !== activePosterUriRef.current) return;
                                posterCoveringRef.current = true;
                                // Poster bytes are on screen — drop the pending spinner
                                // immediately, independent of ExoPlayer readiness.
                                setPosterPaintedForSlide(true);
                                markUrlLoaded(slideRawUrl);
                                fadeOutPosterCover();
                            }}
                            onError={() => {
                                paintedPosterUrisRef.current.add(slidePosterUri);
                                if (!slideIsCurrent) return;
                                posterCoveringRef.current = true;
                                setPosterPaintedForSlide(true);
                                markUrlLoaded(slideRawUrl);
                                fadeOutPosterCover();
                            }}
                        />
                    ) : null}
                </Animated.View>

                {slideMountVideo ? (
                    <View
                        style={
                            viewerSurface
                                ? [styles.viewerVideoClip]
                                : [styles.videoClip, styles.videoTopLayer]
                        }
                        pointerEvents={mediaPointerEvents}
                        collapsable={false}
                    >
                        {/* Top layer, ABOVE the opaque poster base. Transparent until the
                            first composited frame, then faded in (0 -> 1) — the poster below
                            is never lifted, so no void can show through mid-mount. */}
                        <Animated.View
                            style={[
                                viewerSurface ? styles.viewerVideoClip : styles.videoClip,
                                {
                                    opacity:
                                        viewerSurface
                                            ? 1
                                            : videoSurfaceReady
                                              ? videoOpacity
                                              : 0,
                                },
                            ]}
                            pointerEvents="none"
                            collapsable={false}
                        >
                        <FeedNativeVideo
                            videoKey={`video-${post.id}-${slideIndex}-${slideRawUrl}-${playerEpoch}`}
                            postId={String(post.id)}
                            source={cachedVideoSource as object}
                            paused={
                                mode === 'detail'
                                    ? paused
                                    : !isAudioPrimary || slideDragHeld || feedVideoHeld
                            }
                            muted={mode === 'feed' ? !soundOn || !videoSurfaceReady : false}
                            soundOn={soundOn}
                            repeat
                            mode={mode}
                            resizeMode={slideResizeMode}
                            isViewable={feedSurfaceMounted}
                            videoRef={feedVideoRef}
                            onLoadStart={() => {
                                beginUrlLoad(slideRawUrl);
                            }}
                            onReadyForDisplay={onFirstFrameReady}
                            onLoad={(meta) => {
                                // Metrics + handoff only -- the FADE stays on onReadyForDisplay.
                                markUrlLoaded(slideRawUrl);
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
                                //
                                // In feed mode this is handed UP to the wrapper (see
                                // `reportMeasuredSize`), which adopts it immediately and
                                // re-renders this card at the corrected height — no
                                // waiting for the cell to be recycled.
                                const ns = meta?.naturalSize;
                                if (ns) {
                                    reportMeasuredSize({
                                        width: Number(ns.width),
                                        height: Number(ns.height),
                                    });
                                }
                            }}
                            onProgress={(e) => {
                                const t = e?.currentTime;
                                if (typeof t === 'number' && Number.isFinite(t)) {
                                    playbackTimeRef.current = t;
                                    // Android first-frame gate: the immediate tick at
                                    // STATE_READY reports ~0s (frame not composited yet); a
                                    // later, non-zero tick proves the decoder is rendering.
                                    if (!progressReadyRef.current && t > 0.05) {
                                        progressReadyRef.current = true;
                                        fadeOutPosterCover();
                                    }
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
                        </Animated.View>
                    </View>
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
                <ScrollView
                    ref={carouselScrollRef}
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    onScrollBeginDrag={onCarouselScrollBeginDrag}
                    onScroll={onCarouselScroll}
                    onScrollEndDrag={onCarouselScrollEndDrag}
                    onMomentumScrollEnd={onCarouselScroll}
                    style={frameStyle}
                >
                    {carouselItems.map((item, index) => (
                        <View
                            key={`${post.id}-carousel-${index}-${item.url}`}
                            // Explicit layout box: fixed frame size (frameStyle), relative
                            // positioning and hard overflow clipping so a slide can never
                            // paint past its own page bounds. Inactive pages are inert to
                            // touch; only the active slide mounts a native surface.
                            style={[styles.mediaFrame, styles.carouselSlide, frameStyle]}
                            pointerEvents={index === currentIndex ? 'auto' : 'none'}
                        >
                            {renderSlide(item, index)}
                        </View>
                    ))}
                </ScrollView>
            ) : (
                // Single clip box — avoid nesting a second mediaFrame around the slide.
                inner
            )}
        </>
    );

    return (
        <View
            style={[
                styles.wrap,
                mode === 'detail' || immediateVideoSurface ? styles.viewerFrame : styles.mediaFrame,
                frameStyle,
                style,
            ]}
            collapsable={false}
        >
            {feedTapCapture && hasCarousel ? (
                <GestureDetector gesture={mediaTapGesture}>
                    <View
                        style={[styles.mediaFrame, frameStyle]}
                        collapsable={false}
                    >
                        {mediaBody}
                    </View>
                </GestureDetector>
            ) : (
                mediaBody
            )}
            {showMediaPendingOverlay ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                </View>
            ) : null}
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
            {mode === 'feed' && !immediateVideoSurface ? (
            <LinearGradient
                style={styles.mediaScrim}
                colors={['transparent', 'rgba(11, 14, 20, 0.90)']}
                pointerEvents="none"
            />
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
            prev.isActive === next.isActive &&
            prev.immediateVideoSurface === next.immediateVideoSurface &&
            prev.suspendNativeVideo === next.suspendNativeVideo &&
            prev.holdNativeVideo === next.holdNativeVideo &&
            prev.carouselIndex === next.carouselIndex &&
            prev.onSingleTap === next.onSingleTap &&
            prev.onDoubleLike === next.onDoubleLike &&
            mediaItemsEqual(a.mediaItems, b.mediaItems)
        );
    },
);

export default FeedPostMedia;

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: POSTER_FALLBACK_COLOR,
    },
    /** Strict per-slide layout box: clips every slide to its own frame. */
    carouselSlide: {
        overflow: 'hidden',
        position: 'relative',
    },
    mediaFrame: {
        overflow: 'hidden',
        backgroundColor: POSTER_FALLBACK_COLOR,
        position: 'relative',
        borderRadius: 20,
    },
    /** Post viewer: no overflow clip / radius — those blank TextureView on Android. */
    viewerFrame: {
        overflow: 'visible',
        backgroundColor: '#000000',
        position: 'relative',
        borderRadius: 0,
    },
    videoClip: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
        borderRadius: 20,
    },
    viewerVideoClip: {
        ...StyleSheet.absoluteFill,
        overflow: 'visible',
        width: '100%',
        height: '100%',
    },
    /** Top layer, above the poster base. Transparent until ExoPlayer paints a frame. */
    videoTopLayer: {
        zIndex: 2,
        elevation: Platform.OS === 'android' ? 2 : 0,
    },
    stillImage: {
        ...StyleSheet.absoluteFill,
        width: '100%',
        height: '100%',
        opacity: 1,
    },
    /** Explicit fill — Android TextureView collapses to 0×0 without width/height. */
    videoFill: {
        ...StyleSheet.absoluteFill,
        width: '100%',
        height: '100%',
    },
    /** Opaque base layer under the video top layer; stays opaque for the whole mount. */
    posterCover: {
        ...StyleSheet.absoluteFill,
        width: '100%',
        height: '100%',
        zIndex: 1,
        elevation: Platform.OS === 'android' ? 1 : 0,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        zIndex: 6,
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
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 25,
        elevation: Platform.OS === 'android' ? 25 : 0,
    },
    mediaScrim: {
        ...FEED_CARD_MEDIA_SCRIM,
        zIndex: 2,
        elevation: 0,
    },
    videoFallback: {
        backgroundColor: '#121212',
    },
    mediaFill: {
        ...StyleSheet.absoluteFill,
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
