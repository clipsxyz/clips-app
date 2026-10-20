import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Image,
    StyleSheet,
    ScrollView,
    Dimensions,
    Animated,
    NativeScrollEvent,
    NativeSyntheticEvent,
    type GestureResponderEvent,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type OnProgressData, type VideoRef } from 'react-native-video';
import type { Post } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import ScenesTextPostCard from './ScenesTextPostCard.native';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import {
    getScenesMediaSlides,
    resolveScenesVideoUrl,
    scenesVideoSource,
} from '../utils/scenesMediaNative';
import { fitContainBox, intrinsicRatio } from '../utils/mediaAspectRatio';

type Props = {
    post: Post;
    isActive: boolean;
    paused: boolean;
    muted: boolean;
    /** Explicit volume (0–1). Prefer 0 while comments suppress audio — mute alone can lag on Android. */
    volume?: number;
    /**
     * Fully unmount native Video (feed comments parity). Pause alone leaves ExoPlayer
     * audio buffers that lag behind the comments Modal on Android.
     */
    suspendPlayback?: boolean;
    width?: number;
    height: number;
    videoRef?: React.RefObject<VideoRef | null>;
    onVideoLoad?: () => void;
    onVideoProgress?: (e: OnProgressData) => void;
    /** Segmented progress for current slide (0–1). */
    onSlideProgress?: (progress: number) => void;
    onSlideIndexChange?: (index: number) => void;
    showPauseOverlay?: boolean;
    /** FeedPostMedia-style overlay — receives taps above video/scroll (required for Scenes double-tap). */
    onMediaPress?: (event: GestureResponderEvent) => void;
    onMediaLongPress?: () => void;
    onMediaPressOut?: () => void;
};

export default function ScenesMediaPlayer({
    post,
    isActive,
    paused,
    muted,
    volume,
    suspendPlayback = false,
    width: widthProp,
    height,
    videoRef: externalVideoRef,
    onVideoLoad,
    onVideoProgress,
    onSlideProgress,
    onSlideIndexChange,
    showPauseOverlay = false,
    onMediaPress,
    onMediaLongPress,
    onMediaPressOut,
}: Props) {
    const width = widthProp ?? Dimensions.get('window').width;
    const outputVolume = typeof volume === 'number' ? volume : muted ? 0 : 1;
    const canPlayVideo = isActive && !suspendPlayback;
    const slides = useMemo(() => getScenesMediaSlides(post), [post]);
    const hasCarousel = slides.length > 1;
    const [slideIndex, setSlideIndex] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    /** Runtime-measured dimensions per slide (`postId|index`), for slides whose
     * payload carried none. Lets an unmeasured landscape clip re-fit on `onLoad`
     * instead of staying cropped in the portrait stage. */
    const [measuredBySlide, setMeasuredBySlide] = useState<
        Record<string, { width: number; height: number }>
    >({});

    /** Intrinsic size of a slide: payload dimensions first, then the runtime measurement. */
    const slideDims = useCallback(
        (slide: (typeof slides)[number], index: number) => {
            if (intrinsicRatio(slide.width, slide.height) != null) {
                return { width: Number(slide.width), height: Number(slide.height) };
            }
            return measuredBySlide[`${post.id}|${index}`] ?? null;
        },
        [measuredBySlide, post.id, slides],
    );

    /** Aspect-correct frame for a slide inside the full-screen stage. */
    const slideFrame = useCallback(
        (slide: (typeof slides)[number], index: number) => {
            const dims = slideDims(slide, index);
            return fitContainBox(width, height, dims?.width, dims?.height);
        },
        [height, slideDims, width],
    );

    const recordMeasuredForSlide = useCallback(
        (index: number) =>
            (size: { width: number; height: number }) => {
                const key = `${post.id}|${index}`;
                setMeasuredBySlide((prev) =>
                    prev[key]?.width === size.width && prev[key]?.height === size.height
                        ? prev
                        : { ...prev, [key]: size },
                );
            },
        [post.id],
    );

    /** Landscape (and unknown) frames letterbox; known portrait fills its fitted frame. */
    const slideResizeMode = useCallback(
        (slide: (typeof slides)[number], index: number): 'cover' | 'contain' => {
            const dims = slideDims(slide, index);
            if (!dims) return 'contain';
            return dims.width > dims.height ? 'contain' : 'cover';
        },
        [slideDims],
    );
    const internalVideoRef = useRef<VideoRef>(null);
    const videoRef = externalVideoRef ?? internalVideoRef;
    const scrollRef = useRef<ScrollView>(null);

    const safeIndex = Math.min(slideIndex, Math.max(0, slides.length - 1));

    /**
     * First composited frame for the ACTIVE slide, plus the poster-cover crossfade state.
     * Full-screen carousels used to mount the TextureView raw, so every swipe showed a
     * black rectangle until ExoPlayer painted. We now hold a poster over the player and
     * only fade it out once `onReadyForDisplay` confirms pixels are on the surface — the
     * exact gate the feed already uses, so there is never a black flash on a page turn.
     */
    const [videoSurfaceReady, setVideoSurfaceReady] = useState(false);
    const [appliedSurfaceKey, setAppliedSurfaceKey] = useState('');
    const posterOpacity = useRef(new Animated.Value(1)).current;
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const mediaRevealRef = useRef<Animated.CompositeAnimation | null>(null);
    const firstFrameReadyRef = useRef(false);
    /** Opaque poster (or the black mask, when there is no thumbnail) covers the frame. */
    const posterCoveringRef = useRef(true);

    // Identity of the frame that must be masked. Compared during render so the poster
    // snaps back to opaque in the SAME commit that mounts the new TextureView — an effect
    // runs after paint and would leak one black frame on the freshly-swiped slide.
    const activeSurfaceKey = `${post.id}|${safeIndex}|${canPlayVideo ? 1 : 0}|${
        suspendPlayback ? 1 : 0
    }`;
    if (appliedSurfaceKey !== activeSurfaceKey) {
        mediaRevealRef.current?.stop();
        mediaRevealRef.current = null;
        firstFrameReadyRef.current = false;
        posterCoveringRef.current = true;
        posterOpacity.setValue(1);
        videoOpacity.setValue(0);
        setVideoSurfaceReady(false);
        setAppliedSurfaceKey(activeSurfaceKey);
    }

    const fadeOutPosterCover = useCallback(() => {
        if (!firstFrameReadyRef.current || !posterCoveringRef.current) return;
        setVideoSurfaceReady((prev) => {
            if (prev) return prev;
            mediaRevealRef.current?.stop();
            mediaRevealRef.current = Animated.parallel([
                Animated.timing(videoOpacity, {
                    toValue: 1,
                    duration: 120,
                    useNativeDriver: true,
                }),
                Animated.timing(posterOpacity, {
                    toValue: 0,
                    duration: 120,
                    useNativeDriver: true,
                }),
            ]);
            mediaRevealRef.current.start();
            return true;
        });
    }, [posterOpacity, videoOpacity]);

    const onSurfaceReady = useCallback(() => {
        firstFrameReadyRef.current = true;
        fadeOutPosterCover();
    }, [fadeOutPosterCover]);

    useEffect(() => {
        setSlideIndex(0);
        scrollRef.current?.scrollTo({ x: 0, animated: false });
    }, [post.id]);

    useEffect(() => {
        onSlideIndexChange?.(safeIndex);
        const slide = slides[safeIndex];
        if (slide?.type === 'text' || slide?.type === 'image') {
            onSlideProgress?.(1);
        }
    }, [onSlideIndexChange, onSlideProgress, safeIndex, slides]);

    const onCarouselScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!hasCarousel || !width) return;
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            const clamped = Math.max(0, Math.min(next, slides.length - 1));
            if (clamped !== slideIndex) {
                setSlideIndex(clamped);
                onSlideProgress?.(0);
            }
        },
        [hasCarousel, onSlideProgress, slideIndex, slides.length, width],
    );

    const playableSource = (raw: string) => {
        const src = scenesVideoSource(raw);
        if (typeof src === 'number') return src;
        if (src && isPlayableVideoUri(src.uri)) return src;
        return null;
    };

    const videoFillStyle = { width: '100%' as const, height: '100%' as const };

    const renderTapCapture = (enabled: boolean) =>
        enabled && onMediaPress ? (
            <Pressable
                style={styles.tapCapture}
                onPress={(event) => onMediaPress?.(event as unknown as GestureResponderEvent)}
                onLongPress={onMediaLongPress}
                onPressOut={onMediaPressOut}
                delayLongPress={320}
                android_disableSound
            />
        ) : null;

    const handleProgress = useCallback(
        (e: OnProgressData) => {
            onVideoProgress?.(e);
            if (e.seekableDuration > 0) {
                onSlideProgress?.(e.currentTime / e.seekableDuration);
            }
        },
        [onSlideProgress, onVideoProgress],
    );

    /**
     * The active native player, fenced behind a poster cover and an opacity gate.
     *
     * The player is invisible (and muted) until `onReadyForDisplay` confirms a frame has
     * composited; only then does the poster fade out and the video fade in. This is the
     * feed's proven pattern, lifted here so a full-screen page turn never shows the black
     * TextureView that ExoPlayer exposes between mount and first paint.
     */
    const renderCoveredVideo = (
        source: object,
        posterUri: string | undefined,
        refProp?: React.RefObject<VideoRef | null>,
        onProgressOverride?: (e: OnProgressData) => void,
        frameResizeMode: 'cover' | 'contain' = 'cover',
        onLoadMeta?: (meta: { width: number; height: number }) => void,
    ) => (
        <>
            <Animated.View
                style={[StyleSheet.absoluteFill, { opacity: videoSurfaceReady ? videoOpacity : 0 }]}
                pointerEvents="none"
                collapsable={false}
            >
                <Video
                    ref={refProp}
                    source={source}
                    style={videoFillStyle}
                    resizeMode={frameResizeMode}
                    repeat
                    paused={paused}
                    muted={muted || outputVolume <= 0 || !videoSurfaceReady}
                    volume={outputVolume}
                    poster={undefined}
                    posterResizeMode={frameResizeMode}
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="ignore"
                    useTextureView
                    {...androidListSafeVideoProps()}
                    pointerEvents="none"
                    onLoad={(meta) => {
                        onVideoLoad?.();
                        const ns = meta?.naturalSize;
                        if (ns && intrinsicRatio(Number(ns.width), Number(ns.height)) != null) {
                            onLoadMeta?.({
                                width: Number(ns.width),
                                height: Number(ns.height),
                            });
                        }
                    }}
                    onReadyForDisplay={() => {
                        onVideoLoad?.();
                        onSurfaceReady();
                    }}
                    onProgress={onProgressOverride ?? handleProgress}
                />
            </Animated.View>
            <Animated.View
                style={[StyleSheet.absoluteFill, { opacity: posterOpacity }]}
                pointerEvents="none"
                collapsable={false}
            >
                {posterUri ? (
                    <Image
                        source={{ uri: posterUri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode={frameResizeMode}
                    />
                ) : (
                    <View style={styles.fallback} />
                )}
            </Animated.View>
        </>
    );

    const renderSlide = (slide: (typeof slides)[number], index: number) => {
        const slideActive = isActive && index === safeIndex;
        const rawUrl = slide.url;
        const playbackUrl = slide.type === 'video' ? resolveScenesVideoUrl(rawUrl) : rawUrl;
        const poster = slide.posterUrl || post.videoPosterUrl;

        if (slide.type === 'text') {
            return (
                <View key={`${post.id}-${index}-text`} style={[styles.slide, { width, height }]}>
                    <ScenesTextPostCard
                        post={post}
                        text={slide.text || post.text || post.caption || ''}
                        textStyle={slide.textStyle}
                    />
                </View>
            );
        }

        // Aspect-correct frame, centred in the full-screen stage: a landscape clip
        // gets a widescreen box (letterboxed top/bottom on the black stage) instead
        // of being stretched/cropped into the portrait window. The page itself stays
        // full-size so paging geometry and tap capture are unchanged.
        const frame = slideFrame(slide, index);
        const frameResizeMode = slideResizeMode(slide, index);
        const recordMeasured = recordMeasuredForSlide(index);

        return (
            <View
                key={`${post.id}-${index}-${rawUrl}`}
                style={[styles.slide, styles.slideCenter, { width, height }]}
            >
                <View style={{ width: frame.width, height: frame.height }} collapsable={false}>
                    {slide.type === 'video' ? (
                        slideActive && canPlayVideo && playableSource(rawUrl) ? (
                            renderCoveredVideo(
                                playableSource(rawUrl) as object,
                                poster,
                                slideActive ? videoRef : undefined,
                                (e) => {
                                    onVideoProgress?.(e);
                                    if (e.seekableDuration > 0) {
                                        onSlideProgress?.(e.currentTime / e.seekableDuration);
                                    }
                                },
                                frameResizeMode,
                                recordMeasured,
                            )
                        ) : poster ? (
                            <Image
                                source={{ uri: poster }}
                                style={StyleSheet.absoluteFill}
                                resizeMode={frameResizeMode}
                            />
                        ) : (
                            <View style={styles.fallback} />
                        )
                    ) : playbackUrl ? (
                        <Image
                            source={{ uri: playbackUrl }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={styles.fallback} />
                    )}
                </View>
            </View>
        );
    };

    return (
        <View
            style={[styles.root, { height }]}
            onLayout={(e) => {
                const { width: w, height: h } = e.nativeEvent.layout;
                if (w > 0 && h > 0) setContainerSize({ width: w, height: h });
            }}
        >
            {hasCarousel ? (
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={false}
                    // Keep swipe available even while paused (no next/prev chevrons).
                    scrollEnabled={isActive}
                    onMomentumScrollEnd={onCarouselScrollEnd}
                    style={{ width, height }}
                >
                    {slides.map((slide, i) => {
                        const slideActive = isActive && i === safeIndex;
                        return (
                            <View key={`${post.id}-wrap-${i}`} style={{ width, height }}>
                                {slide.type === 'text' ? (
                                    <>
                                        {renderSlide(slide, i)}
                                        {slideActive ? renderTapCapture(true) : null}
                                    </>
                                ) : slide.type === 'video' && slideActive && canPlayVideo && playableSource(slide.url) ? (
                                    <View style={[styles.slide, styles.slideCenter, { width, height }]}>
                                        <View
                                            style={{
                                                width: slideFrame(slide, i).width,
                                                height: slideFrame(slide, i).height,
                                            }}
                                            collapsable={false}
                                        >
                                            {renderCoveredVideo(
                                                playableSource(slide.url) as object,
                                                slide.posterUrl || post.videoPosterUrl,
                                                videoRef,
                                                undefined,
                                                slideResizeMode(slide, i),
                                                recordMeasuredForSlide(i),
                                            )}
                                        </View>
                                        {renderTapCapture(true)}
                                    </View>
                                ) : (
                                    <>
                                        {renderSlide(slide, i)}
                                        {slideActive ? renderTapCapture(true) : null}
                                    </>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            ) : slides.length === 1 ? (
                slides[0].type === 'text' ? (
                    renderSlide(slides[0], 0)
                ) : slides[0].type === 'video' && canPlayVideo && playableSource(slides[0].url) ? (
                    <View style={[styles.slide, styles.slideCenter, { width, height }]}>
                        <View
                            style={{
                                width: slideFrame(slides[0], 0).width,
                                height: slideFrame(slides[0], 0).height,
                            }}
                            collapsable={false}
                        >
                            {renderCoveredVideo(
                                playableSource(slides[0].url) as object,
                                slides[0].posterUrl || post.videoPosterUrl,
                                videoRef,
                                undefined,
                                slideResizeMode(slides[0], 0),
                                recordMeasuredForSlide(0),
                            )}
                        </View>
                    </View>
                ) : (
                    renderSlide(slides[0], 0)
                )
            ) : (
                <View style={styles.fallback} />
            )}

            {post.stickers && post.stickers.length > 0 && containerSize.width > 0 ? (
                <FeedStickerOverlays
                    stickers={post.stickers}
                    containerWidth={containerSize.width}
                    containerHeight={containerSize.height}
                />
            ) : null}

            {hasCarousel ? (
                <View style={styles.dotsRow} pointerEvents="none">
                    {slides.map((_, i) => (
                        <View
                            key={i}
                            style={[styles.dot, i === safeIndex && styles.dotActive]}
                        />
                    ))}
                </View>
            ) : null}

            {showPauseOverlay && paused ? (
                <View style={styles.pauseOverlay} pointerEvents="none">
                    <View style={styles.pauseBadge}>
                        <Icon name="play" size={28} color="#FFFFFF" />
                    </View>
                </View>
            ) : null}

            {/* Full-bleed tap only for single media — on carousels it blocked horizontal swipe. */}
            {!hasCarousel && onMediaPress && isActive ? renderTapCapture(true) : null}
        </View>
    );
}

export function ScenesMediaProgressBar({
    slides,
    activeIndex,
    videoProgress,
    style,
}: {
    slides: ReturnType<typeof getScenesMediaSlides>;
    activeIndex: number;
    videoProgress: number;
    style?: object;
}) {
    if (slides.length === 0) return null;
    const showBar =
        slides.length > 1 || slides.some((s) => s.type === 'video' || s.type === 'text');
    if (!showBar) return null;

    return (
        <View style={[styles.progressRow, style]}>
            {slides.map((slide, i) => {
                let pct = 0;
                if (i < activeIndex) pct = 100;
                else if (i === activeIndex) {
                    pct =
                        slide.type === 'video'
                            ? videoProgress * 100
                            : slide.type === 'text' || slide.type === 'image'
                              ? 100
                              : 0;
                }
                return (
                    <View key={i} style={styles.progressSegmentTrack}>
                        <View style={[styles.progressSegmentFill, { width: `${pct}%` }]} />
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    slide: {
        backgroundColor: '#000',
    },
    /** Centres the aspect-fitted frame inside the full-screen page. */
    slideCenter: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallback: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#121212',
    },
    dotsRow: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 11,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    dotActive: {
        backgroundColor: '#FFFFFF',
    },
    tapCapture: {
        ...StyleSheet.absoluteFill,
        zIndex: 10,
    },
    pauseOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.15)',
        zIndex: 20,
    },
    pauseBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRow: {
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 10,
    },
    progressSegmentTrack: {
        flex: 1,
        height: 2.5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.35)',
        overflow: 'hidden',
    },
    progressSegmentFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
    },
});
