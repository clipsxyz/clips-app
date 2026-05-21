import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import type { StickerOverlay } from '../types';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { Post } from '../types';
import { subscribeActiveFeedVideo } from '../utils/feedActiveVideoNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia } from '../utils/postMedia';
import VideoCTAOverlay from './VideoCTAOverlay.native';
import FeedVideoCaptionOverlay from './FeedVideoCaptionOverlay.native';

export type FeedPostMediaHandle = {
    toggleVideoMute: () => void;
};

type Props = {
    post: Post;
    /** When set, shows that carousel slide instead of the first item. */
    carouselIndex?: number;
    onCarouselIndexChange?: (index: number) => void;
    width: number;
    height: number;
    onPress?: (event?: GestureResponderEvent) => void;
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
    const [soundOn, setSoundOn] = useState(!muted);
    const [muteFlash, setMuteFlash] = useState(false);
    const loadedUrlsRef = useRef<Set<string>>(new Set());
    const mediaLoadReportedRef = useRef(false);
    const carouselScrollRef = useRef<ScrollView>(null);
    const lastEmittedIndexRef = useRef(0);

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
    const mediaUrl = activeItem?.url || post.mediaUrl;
    const postLevelPoster = post.videoPosterUrl;
    const activeIsVideo = activeItem?.type === 'video' || (!activeItem && isVideoPost(post));
    const activeIsImage = !activeIsVideo && !!mediaUrl;
    const imageText =
        activeIsImage && post.imageText ? String(post.imageText).trim() : '';

    const textOnly = isTextOnlyPost(post);
    const video = !textOnly && activeIsVideo && !!mediaUrl;
    const showScenesCta = mode === 'feed' && video && postHasVideoMedia(post) && Boolean(onOpenScenes);
    const feedShouldPlay = mode === 'feed' && video && isActive && !playFailed;

    useImperativeHandle(
        ref,
        () => ({
            toggleVideoMute: () => {
                if (!video || mode !== 'feed') return;
                setSoundOn((v) => !v);
                setMuteFlash(true);
                setTimeout(() => setMuteFlash(false), 1100);
            },
        }),
        [mode, video],
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
            }
        });
    }, [mode, post.id, video]);

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

    const suppressContextMenu = () => {
        /* Best-effort: consume long-press on feed media (no web context menu on RN). */
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

    const onVideoError = (url: string) => {
        setPlayFailed(true);
        markUrlLoaded(url);
    };

    const renderSlide = (item: (typeof carouselItems)[number], slideIndex: number) => {
        const slideUrl = item?.url || post.mediaUrl;
        if (!slideUrl) return <View style={frameStyle} />;

        const slideIsVideo = item?.type === 'video' || (!item && isVideoPost(post));
        const slideVideo = !textOnly && slideIsVideo;
        const slideFeedPlay =
            mode === 'feed' && slideVideo && isActive && slideIndex === currentIndex && !playFailed;
        const showLoader = !slideVideo && !!loadingByUrl[slideUrl] && !loadedUrlsRef.current.has(slideUrl);

        const slidePoster =
            (item as { posterUrl?: string } | undefined)?.posterUrl || postLevelPoster;

        const slideInner = slideVideo ? (
            mode === 'detail' ? (
                <Video
                    source={{ uri: slideUrl }}
                    style={frameStyle}
                    resizeMode="contain"
                    controls
                    paused={paused}
                    poster={slidePoster}
                    posterResizeMode="cover"
                    onLoad={() => markUrlLoaded(slideUrl)}
                    onError={() => onVideoError(slideUrl)}
                />
            ) : slideFeedPlay ? (
                <Video
                    source={{ uri: slideUrl }}
                    style={frameStyle}
                    resizeMode="cover"
                    paused={false}
                    muted={!soundOn}
                    repeat
                    poster={slidePoster}
                    posterResizeMode="cover"
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="ignore"
                    onLoad={() => markUrlLoaded(slideUrl)}
                    onError={() => onVideoError(slideUrl)}
                />
            ) : slidePoster || playFailed ? (
                <Image
                    source={{ uri: slidePoster || slideUrl }}
                    style={frameStyle}
                    resizeMode="cover"
                    resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                    onLoadStart={() => beginUrlLoad(slideUrl)}
                    onLoad={() => markUrlLoaded(slideUrl)}
                    onError={() => markUrlLoaded(slideUrl)}
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
                progressiveRenderingEnabled
                onLoadStart={() => beginUrlLoad(slideUrl)}
                onLoad={() => markUrlLoaded(slideUrl)}
                onError={() => markUrlLoaded(slideUrl)}
            />
        );

        return (
            <View style={frameStyle}>
                {slideInner}
                {showLoader ? (
                    <View style={styles.loadingOverlay} pointerEvents="none">
                        <ActivityIndicator color="#f472b6" />
                    </View>
                ) : null}
                {onPress ? (
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={onPress}
                        onLongPress={suppressContextMenu}
                        delayLongPress={400}
                    />
                ) : null}
            </View>
        );
    };

    const inner = video ? (
        mode === 'detail' ? (
            <Video
                source={{ uri: mediaUrl }}
                style={frameStyle}
                resizeMode="contain"
                controls
                paused={paused}
                poster={postLevelPoster}
                posterResizeMode="cover"
                onLoad={() => mediaUrl && markUrlLoaded(mediaUrl)}
                onError={() => mediaUrl && markUrlLoaded(mediaUrl)}
            />
        ) : feedShouldPlay ? (
            <Video
                source={{ uri: mediaUrl }}
                style={frameStyle}
                resizeMode="cover"
                paused={false}
                muted={!soundOn}
                repeat
                poster={postLevelPoster}
                posterResizeMode="cover"
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
                onLoad={() => mediaUrl && markUrlLoaded(mediaUrl)}
                onError={() => mediaUrl && onVideoError(mediaUrl)}
            />
        ) : postLevelPoster || playFailed ? (
            <Image
                source={{ uri: postLevelPoster || mediaUrl }}
                style={frameStyle}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                onLoadStart={() => mediaUrl && beginUrlLoad(mediaUrl)}
                onLoad={() => mediaUrl && markUrlLoaded(mediaUrl)}
                onError={() => mediaUrl && markUrlLoaded(mediaUrl)}
            />
        ) : (
            <View style={[frameStyle, styles.videoFallback]}>
                {mediaUrl && loadingByUrl[mediaUrl] && !loadedUrlsRef.current.has(mediaUrl) ? (
                    <ActivityIndicator color="#f472b6" />
                ) : null}
                <Icon name="videocam-outline" size={36} color="#6B7280" />
            </View>
        )
    ) : hasCarousel ? null : (
        renderSlide(activeItem!, 0)
    );

    return (
        <View style={[styles.wrap, { width, height }, style]}>
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
                <Pressable
                    onPress={onPress}
                    onLongPress={suppressContextMenu}
                    delayLongPress={400}
                    style={{ width, height }}
                >
                    {inner}
                    {mediaUrl && loadingByUrl[mediaUrl] && !loadedUrlsRef.current.has(mediaUrl) && !video ? (
                        <View style={styles.loadingOverlay} pointerEvents="none">
                            <ActivityIndicator color="#f472b6" />
                        </View>
                    ) : null}
                </Pressable>
            )}
            {video ? <FeedVideoCaptionOverlay post={post} /> : null}
            {showScenesCta ? (
                <VideoCTAOverlay onPress={() => onOpenScenes?.()} userHandle={post.userHandle} />
            ) : null}
            {feedShouldPlay || muteFlash ? (
                <Pressable
                    style={styles.muteButton}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        setSoundOn((v) => !v);
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
        zIndex: 4,
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
});
