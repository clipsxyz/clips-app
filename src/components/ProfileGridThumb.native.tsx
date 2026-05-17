import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { getTextOnlyBackgroundColor, isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';

type Props = {
    post: Post;
};

export default function ProfileGridThumb({ post }: Props) {
    if (isTextOnlyPost(post)) {
        return (
            <View style={[styles.cell, { backgroundColor: getTextOnlyBackgroundColor(post) }]}>
                <Text style={styles.textThumb} numberOfLines={4}>
                    {post.text}
                </Text>
            </View>
        );
    }

    const poster = isVideoPost(post) && post.videoPosterUrl ? post.videoPosterUrl : post.mediaUrl;
    if (!poster) {
        return (
            <View style={[styles.cell, styles.placeholder]}>
                <Icon name="text" size={22} color="#6B7280" />
            </View>
        );
    }

    return (
        <View style={styles.cell}>
            <Image source={{ uri: poster }} style={styles.image} resizeMode="cover" />
            {isVideoPost(post) ? (
                <View style={styles.playIcon} pointerEvents="none">
                    <Icon name="play" size={14} color="#FFFFFF" />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    cell: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textThumb: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
        padding: 6,
        lineHeight: 13,
    },
    playIcon: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        padding: 3,
    },
});
