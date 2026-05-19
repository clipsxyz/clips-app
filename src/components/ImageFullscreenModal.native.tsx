import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    View,
    Image,
    StyleSheet,
    Pressable,
    Text,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import FeedEngagementRow from './FeedEngagementRow';

type Props = {
    post: Post | null;
    visible: boolean;
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
    onClose,
    onLike,
    onComment,
    onReclip,
    onShare,
}: Props) {
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(0);
    const images = useMemo(() => (post ? collectImageUrls(post) : []), [post]);

    useEffect(() => {
        if (visible) setIndex(0);
    }, [visible, post?.id]);

    if (!post || !images.length) return null;

    const hasCarousel = images.length > 1;

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
            <StatusBar barStyle="light-content" />
            <View style={styles.root}>
                <Image
                    source={{ uri: images[index] }}
                    style={styles.image}
                    resizeMode="contain"
                />

                <Pressable
                    style={[styles.closeBtn, { top: insets.top + 8 }]}
                    onPress={onClose}
                    accessibilityLabel="Close"
                >
                    <Icon name="close" size={26} color="#FFFFFF" />
                </Pressable>

                {hasCarousel ? (
                    <View style={styles.carouselControls}>
                        <Pressable
                            disabled={index <= 0}
                            onPress={() => setIndex((i) => Math.max(0, i - 1))}
                            style={[styles.carouselBtn, index <= 0 && styles.carouselBtnDisabled]}
                        >
                            <Icon name="chevron-back" size={22} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.carouselIndex}>
                            {index + 1} / {images.length}
                        </Text>
                        <Pressable
                            disabled={index >= images.length - 1}
                            onPress={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
                            style={[
                                styles.carouselBtn,
                                index >= images.length - 1 && styles.carouselBtnDisabled,
                            ]}
                        >
                            <Icon name="chevron-forward" size={22} color="#FFFFFF" />
                        </Pressable>
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
                        onShare={onShare}
                        showShare={Boolean(onShare)}
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
    carouselControls: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        marginTop: -22,
    },
    carouselBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    carouselBtnDisabled: {
        opacity: 0.35,
    },
    carouselIndex: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
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
