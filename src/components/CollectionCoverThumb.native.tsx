import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Collection, Post } from '../types';
import { getCollectionThumbnailUrl } from '../api/collections';

type Props = {
    collection: Collection;
    posts?: Post[];
    style?: StyleProp<ViewStyle>;
    iconSize?: number;
};

export default function CollectionCoverThumb({ collection, posts, style, iconSize = 28 }: Props) {
    const src = getCollectionThumbnailUrl(collection, posts);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(!!src);
    const empty = (collection.postIds?.length || 0) === 0 && !collection.latestPost;

    useEffect(() => {
        setFailed(false);
        setLoading(!!src);
    }, [src, collection.id]);

    if (!src || failed || empty) {
        return (
            <View style={[styles.placeholder, style]}>
                <Icon name="bookmark-outline" size={iconSize} color="#94A3B8" />
            </View>
        );
    }

    return (
        <View style={[styles.wrap, style]}>
            <Image
                source={{ uri: src }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoadStart={() => setLoading(true)}
                onLoad={() => setLoading(false)}
                onError={() => {
                    setLoading(false);
                    setFailed(true);
                }}
            />
            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: 'hidden',
        backgroundColor: '#071330',
        borderRadius: 12,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#071330',
        borderRadius: 12,
    },
    loading: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(7, 19, 48, 0.35)',
    },
});
