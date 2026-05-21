import React, { useMemo } from 'react';
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';

type Props = {
    post: Post;
    size: number;
    showBoostIcon?: boolean;
    onPress: () => void;
};

export default function BoostPostTile({ post, size, showBoostIcon = true, onPress }: Props) {
    const textOnly = isTextOnlyPost(post);
    const carouselMedia = (post.mediaItems || []).filter(
        (m) => m?.type === 'image' || m?.type === 'video',
    );
    const first = carouselMedia[0];
    const mediaUrl = first?.url || post.mediaUrl;
    const isVideo = first?.type === 'video' || isVideoPost(post);
    const slidePoster =
        isVideo && (first as { posterUrl?: string } | undefined)?.posterUrl
            ? (first as { posterUrl?: string }).posterUrl
            : isVideo && post.videoPosterUrl
              ? post.videoPosterUrl
              : mediaUrl;
    const poster = slidePoster;

    const displayText = useMemo(() => {
        const raw = post.text || post.caption || '';
        return raw.length > 120 ? `${raw.substring(0, 120)}...` : raw;
    }, [post.text, post.caption]);

    return (
        <Pressable
            onPress={onPress}
            style={[styles.tile, { width: size, height: size }]}
            accessibilityRole="button"
            accessibilityLabel="Boost this post"
        >
            {textOnly ? (
                <View
                    style={[
                        styles.fill,
                        { backgroundColor: getTextOnlyBackgroundColor(post) },
                    ]}
                >
                    <Text
                        style={[styles.tileText, { color: getTextOnlyTextColor(post) }]}
                        numberOfLines={4}
                    >
                        {displayText}
                    </Text>
                </View>
            ) : poster ? (
                <Image source={{ uri: poster }} style={styles.fill} resizeMode="cover" />
            ) : (
                <View style={[styles.fill, styles.placeholder]}>
                    <Icon name="image-outline" size={28} color="#6B7280" />
                </View>
            )}

            {isVideo && !textOnly ? (
                <View style={styles.playBadge} pointerEvents="none">
                    <Icon name="play" size={14} color="#FFFFFF" />
                </View>
            ) : null}

            {showBoostIcon ? (
                <View style={styles.flameWrap} pointerEvents="none">
                    <LinearGradient
                        colors={['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.flameCircle}
                    >
                        <Icon name="flame" size={20} color="#111111" />
                    </LinearGradient>
                </View>
            ) : null}
        </Pressable>
    );
}

export function boostTileSize(cols = 3, gap = 6, horizontalPadding = 8): number {
    const screenWidth = Dimensions.get('window').width;
    return Math.floor(
        (screenWidth - horizontalPadding * 2 - gap * (cols - 1)) / cols,
    );
}

const styles = StyleSheet.create({
    tile: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#111827',
    },
    fill: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1f2937',
    },
    tileText: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
        padding: 10,
    },
    playBadge: {
        position: 'absolute',
        right: 6,
        bottom: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        padding: 4,
    },
    flameWrap: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    flameCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#d4af37',
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
});
