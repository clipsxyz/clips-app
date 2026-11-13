import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Collection, Post } from '../types';
import { collectionCoverPost, getCollectionThumbnailUrl } from '../api/collections';
import { getPostBodyText, getTextOnlyBackgroundColor, getTextOnlyTextColor, isTextOnlyPost } from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';

type Props = {
    collection: Collection;
    posts?: Post[];
    style?: StyleProp<ViewStyle>;
    iconSize?: number;
};

function TextCover({
    collection,
    posts,
    style,
}: {
    collection: Collection;
    posts?: Post[];
    style?: StyleProp<ViewStyle>;
}) {
    const coverPost = collectionCoverPost(collection, posts);
    const bodyText = getPostBodyText(coverPost);
    if (!coverPost || !bodyText) return null;
    const card = isTextCardStyleId(coverPost.cardStyle) ? TEXT_CARD_STYLES[coverPost.cardStyle] : null;
    const textColor = card?.textColor || getTextOnlyTextColor(coverPost);
    const copy = (
        <Text style={[styles.textThumb, { color: textColor }]} numberOfLines={4}>
            {bodyText}
        </Text>
    );
    if (card && card.colors.length >= 2) {
        return (
            <LinearGradient colors={card.colors as [string, string, ...string[]]} style={[styles.textCover, style]}>
                {copy}
            </LinearGradient>
        );
    }
    return (
        <View style={[styles.textCover, style, { backgroundColor: card?.colors[0] || getTextOnlyBackgroundColor(coverPost) }]}>
            {copy}
        </View>
    );
}

export default function CollectionCoverThumb({ collection, posts, style, iconSize = 28 }: Props) {
    const src = getCollectionThumbnailUrl(collection, posts);
    const coverPost = collectionCoverPost(collection, posts);
    const bodyText = getPostBodyText(coverPost);
    const showText = Boolean(coverPost && isTextOnlyPost(coverPost));
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(!!src);
    const empty = (collection.postIds?.length || 0) === 0 && !collection.latestPost && !bodyText;

    useEffect(() => {
        setFailed(false);
        setLoading(!!src);
    }, [src, collection.id]);

    if (showText && (!src || failed || empty)) {
        return <TextCover collection={collection} posts={posts} style={style} />;
    }

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
    textCover: {
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        backgroundColor: '#071330',
        borderRadius: 12,
        overflow: 'hidden',
    },
    textThumb: {
        fontSize: 10,
        fontWeight: '600',
        lineHeight: 13,
        padding: 6,
        alignSelf: 'stretch',
    },
    loading: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(7, 19, 48, 0.35)',
    },
});
