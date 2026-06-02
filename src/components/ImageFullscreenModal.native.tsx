import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    View,
    Image,
    StyleSheet,
    Pressable,
    Text,
    StatusBar,
    ScrollView,
    useWindowDimensions,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';

type Props = {
    post: Post | null;
    visible: boolean;
    /** Slide to show first when opening (feed carousel parity). */
    initialIndex?: number;
    onClose: () => void;
    onLike?: () => void | Promise<void>;
    onComment?: () => void;
    onReclip?: () => void | Promise<void>;
    onShare?: () => void;
    onMenu?: () => void;
};

function collectImageUrls(post: Post): string[] {
    const urls: string[] = [];
    if (post.mediaItems?.length) {
        for (const item of post.mediaItems) {
            if (item.type !== 'image') continue;
            if (item.url) urls.push(item.url);
        }
    }
    if (!urls.length && post.mediaUrl && post.mediaType !== 'video') urls.push(post.mediaUrl);
    return urls;
}

/**
 * Threads-style fullscreen still-image viewer (not Scenes).
 */
export default function ImageFullscreenModal({
    post,
    visible,
    initialIndex = 0,
    onClose,
    onLike,
    onComment,
    onReclip,
    onShare,
    onMenu,
}: Props) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const skipScrollSyncRef = useRef(false);
    const images = useMemo(() => (post ? collectImageUrls(post) : []), [post]);

    useEffect(() => {
        if (!visible) return;
        const max = Math.max(0, images.length - 1);
        const next = Math.min(Math.max(0, initialIndex), max);
        setIndex(next);
        skipScrollSyncRef.current = true;
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: false });
        requestAnimationFrame(() => {
            skipScrollSyncRef.current = false;
        });
    }, [visible, post?.id, initialIndex, images.length, screenWidth]);

    if (!post || !images.length) return null;

    const hasCarousel = images.length > 1;
    const canReclip = true;

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
        setIndex(Math.max(0, Math.min(next, images.length - 1)));
    };

    const goPrev = () => {
        if (!images.length) return;
        const next = (index - 1 + images.length) % images.length;
        setIndex(next);
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    };

    const goNext = () => {
        if (!images.length) return;
        const next = (index + 1) % images.length;
        setIndex(next);
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
            <StatusBar barStyle="light-content" />
            <View style={styles.root}>
                <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0.68)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']}
                    style={styles.topFade}
                />

                {hasCarousel ? (
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        onMomentumScrollEnd={onScrollEnd}
                        style={styles.carousel}
                    >
                        {images.map((uri) => (
                            <View key={uri} style={{ width: screenWidth, height: screenHeight }}>
                                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <Image source={{ uri: images[0] }} style={styles.image} resizeMode="contain" />
                )}

                <Pressable
                    style={[styles.closeBtn, { top: insets.top + 10 }]}
                    onPress={onClose}
                    accessibilityLabel="Close"
                >
                    <Icon name="close" size={26} color="#FFFFFF" />
                </Pressable>

                {onMenu ? (
                    <Pressable
                        style={[styles.menuBtn, { top: insets.top + 10 }]}
                        onPress={onMenu}
                        accessibilityLabel="More options"
                    >
                        <Icon name="ellipsis-horizontal" size={22} color="#FFFFFF" />
                    </Pressable>
                ) : null}

                {hasCarousel ? (
                    <View style={[styles.carouselIndexBadge, { top: insets.top + 18 }]}>
                        <Text style={styles.carouselIndex}>
                            {index + 1} / {images.length}
                        </Text>
                    </View>
                ) : null}

                {hasCarousel ? (
                    <>
                        <Pressable style={[styles.navBtn, styles.navLeft]} onPress={goPrev} accessibilityLabel="Previous image">
                            <Icon name="chevron-back" size={26} color="#FFFFFF" />
                        </Pressable>
                        <Pressable style={[styles.navBtn, styles.navRight]} onPress={goNext} accessibilityLabel="Next image">
                            <Icon name="chevron-forward" size={26} color="#FFFFFF" />
                        </Pressable>
                    </>
                ) : null}

                <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.68)']}
                    style={styles.bottomFade}
                />

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.footerActionRow}>
                        <Pressable style={styles.footerAction} onPress={() => void onLike?.()} accessibilityLabel="Like">
                            <Icon name={post.userLiked ? 'heart' : 'heart-outline'} size={26} color="#FFFFFF" />
                            <Text style={styles.footerCount}>{post.stats?.likes ?? 0}</Text>
                        </Pressable>

                        <Pressable style={styles.footerAction} onPress={onComment} accessibilityLabel="Comments">
                            <Icon name="chatbubble-outline" size={26} color="#FFFFFF" />
                            <Text style={styles.footerCount}>{post.stats?.comments ?? 0}</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.footerAction, (!canReclip || post.userReclipped) && styles.footerActionDisabled]}
                            onPress={() => void onReclip?.()}
                            disabled={!canReclip || post.userReclipped}
                            accessibilityLabel="Reclip"
                        >
                            <Icon name="repeat" size={26} color={post.userReclipped ? '#22D3EE' : '#FFFFFF'} />
                            <Text style={styles.footerCount}>{post.stats?.reclips ?? 0}</Text>
                        </Pressable>

                        <Pressable style={[styles.footerAction, styles.footerActionShare]} onPress={onShare} accessibilityLabel="Share">
                            <Icon name="send-outline" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <Text style={styles.handle} numberOfLines={1}>
                        {post.userHandle}
                    </Text>
                    {post.text?.trim() ? (
                        <Text style={styles.caption} numberOfLines={3}>
                            {post.text}
                        </Text>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
    },
    topFade: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 124,
        zIndex: 7,
    },
    bottomFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 172,
        zIndex: 7,
    },
    image: {
        width: '100%',
        flex: 1,
    },
    closeBtn: {
        position: 'absolute',
        left: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.48)',
        zIndex: 14,
    },
    menuBtn: {
        position: 'absolute',
        right: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.48)',
        zIndex: 14,
    },
    carousel: {
        flex: 1,
    },
    carouselIndexBadge: {
        position: 'absolute',
        right: 62,
        zIndex: 14,
    },
    carouselIndex: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '500',
        backgroundColor: 'rgba(0,0,0,0.42)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        overflow: 'hidden',
    },
    navBtn: {
        position: 'absolute',
        top: '50.5%',
        width: 44,
        height: 44,
        marginTop: -22,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.42)',
        zIndex: 12,
    },
    navLeft: {
        left: 10,
    },
    navRight: {
        right: 10,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        zIndex: 14,
    },
    footerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 24,
        marginBottom: 11,
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 6,
        minHeight: 44,
    },
    footerActionDisabled: {
        opacity: 0.35,
    },
    footerActionShare: {
        marginLeft: 'auto',
    },
    footerCount: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '400',
        fontVariant: ['tabular-nums'],
    },
    handle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 3,
    },
    caption: {
        color: '#E5E7EB',
        fontSize: 13,
        marginBottom: 2,
        lineHeight: 18,
    },
});
