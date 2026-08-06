import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Image,
    StyleSheet,
    ScrollView,
    Dimensions,
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
import {
    getScenesMediaSlides,
    resolveScenesVideoUrl,
    scenesVideoSource,
} from '../utils/scenesMediaNative';

type Props = {
    post: Post;
    isActive: boolean;
    paused: boolean;
    muted: boolean;
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
    const slides = useMemo(() => getScenesMediaSlides(post), [post]);
    const hasCarousel = slides.length > 1;
    const [slideIndex, setSlideIndex] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const internalVideoRef = useRef<VideoRef>(null);
    const videoRef = externalVideoRef ?? internalVideoRef;
    const scrollRef = useRef<ScrollView>(null);

    const safeIndex = Math.min(slideIndex, Math.max(0, slides.length - 1));
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

    const goToSlide = useCallback(
        (delta: number) => {
            const next = Math.max(0, Math.min(slides.length - 1, safeIndex + delta));
            if (next === safeIndex) return;
            setSlideIndex(next);
            scrollRef.current?.scrollTo({ x: next * width, animated: true });
            onSlideProgress?.(0);
        },
        [onSlideProgress, safeIndex, slides.length, width],
    );

    const renderTapCapture = (enabled: boolean) =>
        enabled && onMediaPress ? (
            <Pressable
                style={styles.tapCapture}
                onPress={onMediaPress}
                onLongPress={onMediaLongPress}
                onPressOut={onMediaPressOut}
                delayLongPress={320}
                android_disableSound
            />
        ) : null;

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

        return (
            <View key={`${post.id}-${index}-${rawUrl}`} style={[styles.slide, { width, height }]}>
                {slide.type === 'video' ? (
                    slideActive ? (
                        <Video
                            ref={slideActive ? videoRef : undefined}
                            source={scenesVideoSource(rawUrl)}
                            style={{ width, height }}
                            pointerEvents="none"
                            resizeMode="contain"
                            repeat
                            paused={paused}
                            muted={muted}
                            poster={undefined}
                            posterResizeMode="cover"
                            playInBackground={false}
                            playWhenInactive={false}
                            ignoreSilentSwitch="ignore"
                            onLoad={onVideoLoad}
                            onProgress={(e) => {
                                onVideoProgress?.(e);
                                if (e.seekableDuration > 0) {
                                    onSlideProgress?.(e.currentTime / e.seekableDuration);
                                }
                            }}
                        />
                    ) : poster ? (
                        <Image
                            source={{ uri: poster }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                            pointerEvents="none"
                        />
                    ) : (
                        <View style={styles.fallback} />
                    )
                ) : playbackUrl ? (
                    <Image
                        source={{ uri: playbackUrl }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="contain"
                        pointerEvents="none"
                    />
                ) : (
                    <View style={styles.fallback} />
                )}
            </View>
        );
    };

    const handleProgress = useCallback(
        (e: OnProgressData) => {
            onVideoProgress?.(e);
            if (e.seekableDuration > 0) {
                onSlideProgress?.(e.currentTime / e.seekableDuration);
            }
        },
        [onSlideProgress, onVideoProgress],
    );

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
                    scrollEnabled={isActive && !paused}
                    onMomentumScrollEnd={onCarouselScrollEnd}
                    style={{ width, height }}
                >
                    {slides.map((slide, i) => {
                        const slideActive = isActive && i === safeIndex;
                        return (
                            <View key={`${post.id}-wrap-${i}`} style={{ width, height }}>
                                {slide.type === 'text' ? (
                                    renderSlide(slide, i)
                                ) : slide.type === 'video' && slideActive ? (
                                    <View style={[styles.slide, { width, height }]}>
                                        <Video
                                            ref={videoRef}
                                            source={scenesVideoSource(slide.url)}
                                            style={{ width, height }}
                                            resizeMode="contain"
                                            repeat
                                            paused={paused}
                                            muted={muted}
                                            poster={undefined}
                                            posterResizeMode="cover"
                                            playInBackground={false}
                                            playWhenInactive={false}
                                            ignoreSilentSwitch="ignore"
                                            pointerEvents="none"
                                            onLoad={onVideoLoad}
                                            onProgress={handleProgress}
                                        />
                                    </View>
                                ) : (
                                    renderSlide(slide, i)
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            ) : slides.length === 1 ? (
                slides[0].type === 'text' ? (
                    renderSlide(slides[0], 0)
                ) : slides[0].type === 'video' && isActive ? (
                    <View style={[styles.slide, { width, height }]}>
                        <Video
                            ref={videoRef}
                            source={scenesVideoSource(slides[0].url)}
                            style={{ width, height }}
                            resizeMode="contain"
                            repeat
                            paused={paused}
                            muted={muted}
                            poster={undefined}
                            posterResizeMode="cover"
                            playInBackground={false}
                            playWhenInactive={false}
                            ignoreSilentSwitch="ignore"
                            pointerEvents="none"
                            onLoad={onVideoLoad}
                            onProgress={handleProgress}
                        />
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
                <>
                    {safeIndex > 0 ? (
                        <Pressable
                            style={[styles.chevron, styles.chevronLeft]}
                            onPress={() => goToSlide(-1)}
                            hitSlop={12}
                        >
                            <Icon name="chevron-back" size={28} color="#FFFFFF" />
                        </Pressable>
                    ) : null}
                    {safeIndex < slides.length - 1 ? (
                        <Pressable
                            style={[styles.chevron, styles.chevronRight]}
                            onPress={() => goToSlide(1)}
                            hitSlop={12}
                        >
                            <Icon name="chevron-forward" size={28} color="#FFFFFF" />
                        </Pressable>
                    ) : null}
                    <View style={styles.dotsRow} pointerEvents="none">
                        {slides.map((_, i) => (
                            <View
                                key={i}
                                style={[styles.dot, i === safeIndex && styles.dotActive]}
                            />
                        ))}
                    </View>
                </>
            ) : null}

            {showPauseOverlay && paused ? (
                <View style={styles.pauseOverlay} pointerEvents="none">
                    <View style={styles.pauseBadge}>
                        <Icon name="play" size={28} color="#FFFFFF" />
                    </View>
                </View>
            ) : null}

            {onMediaPress && isActive ? renderTapCapture(true) : null}
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
    fallback: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#111',
    },
    chevron: {
        position: 'absolute',
        top: '50%',
        marginTop: -22,
        zIndex: 12,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 999,
    },
    chevronLeft: { left: 8 },
    chevronRight: { right: 8 },
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
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
    },
    pauseOverlay: {
        ...StyleSheet.absoluteFillObject,
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
