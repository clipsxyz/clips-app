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
import type { Post } from '../types';
import FeedEngagementRow from './FeedEngagementRow';

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
};

function collectImageUrls(post: Post): string[] {
    const urls: string[] = [];
    if (post.mediaItems?.length) {
        for (const item of post.mediaItems) {
            if (item.type === 'video') continue;
            if (item.url) urls.push(item.url);
        }
    }
    if (!urls.length && post.mediaUrl) urls.push(post.mediaUrl);
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

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
        setIndex(Math.max(0, Math.min(next, images.length - 1)));
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
            <StatusBar barStyle="light-content" />
            <View style={styles.root}>
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
                    style={[styles.closeBtn, { top: insets.top + 8 }]}
                    onPress={onClose}
                    accessibilityLabel="Close"
                >
                    <Icon name="close" size={26} color="#FFFFFF" />
                </Pressable>

                {hasCarousel ? (
                    <View style={[styles.carouselIndexBadge, { top: insets.top + 14 }]}>
                        <Text style={styles.carouselIndex}>
                            {index + 1} / {images.length}
                        </Text>
                    </View>
                ) : null}

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <Text style={styles.handle} numberOfLines={1}>
                        {post.userHandle}
                    </Text>
                    {post.text?.trim() ? (
                        <Text style={styles.caption} numberOfLines={3}>
                            {post.text}
                        </Text>
                    ) : null}
                    <FeedEngagementRow
                        likes={post.stats?.likes ?? 0}
                        comments={post.stats?.comments ?? 0}
                        reclips={post.stats?.reclips ?? 0}
                        userLiked={post.userLiked}
                        userReclipped={post.userReclipped}
                        onLike={onLike}
                        onComment={onComment}
                        onReclip={onReclip}
                        onShareToStories={onShare}
                        showShareToStories={Boolean(onShare)}
                    />
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
    image: {
        width: '100%',
        flex: 1,
    },
    closeBtn: {
        position: 'absolute',
        left: 12,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 10,
    },
    carousel: {
        flex: 1,
    },
    carouselIndexBadge: {
        position: 'absolute',
        alignSelf: 'center',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    carouselIndex: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    handle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    caption: {
        color: '#E5E7EB',
        fontSize: 13,
        marginBottom: 10,
        lineHeight: 18,
    },
});
