import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CachedImage from './CachedImage.native';
import type { Post, PostMediaItem } from '../types';
import { resolveCarouselItemStillUri, isVideoMediaUri } from '../utils/postMedia';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import {
    FEED_CARD_CAROUSEL_COUNT,
    FEED_CARD_CAROUSEL_HEADER,
    FEED_CARD_CAROUSEL_RAIL,
    FEED_CARD_CAROUSEL_THUMB,
    FEED_CARD_CAROUSEL_THUMB_ACTIVE,
    FEED_CARD_CAROUSEL_TITLE,
    FEED_CARD_CAROUSEL_WRAP,
} from './FeedPageLayout.native';

type Props = {
    items: PostMediaItem[];
    post: Post;
    activeIndex: number;
    onSelect: (index: number) => void;
};

function CarouselThumb({
    item,
    post,
    index,
    items,
    active,
    onPress,
}: {
    item: PostMediaItem;
    post: Post;
    index: number;
    items: PostMediaItem[];
    active: boolean;
    onPress: () => void;
}) {
    const stillUri = resolveCarouselItemStillUri(item, post, index, items);
    // Last-ditch poster frame from the parent post (helps video tiles whose own still is
    // missing), resolved against the active API origin so it loads on device.
    const postPosterUri = React.useMemo(() => {
        const candidate = resolvePublicMediaUrl(post.videoPosterUrl || post.thumbnailUrl || '');
        if (!candidate || candidate === stillUri || isVideoMediaUri(candidate)) return undefined;
        return candidate;
    }, [post.videoPosterUrl, post.thumbnailUrl, stillUri]);
    const [primaryFailed, setPrimaryFailed] = React.useState(false);
    const [posterFailed, setPosterFailed] = React.useState(false);

    React.useEffect(() => {
        setPrimaryFailed(false);
        setPosterFailed(false);
    }, [stillUri, postPosterUri]);

    const primaryUri = stillUri && !primaryFailed ? stillUri : undefined;
    const imageUri = primaryUri || (!posterFailed ? postPosterUri : undefined);

    return (
        <TouchableOpacity
            style={[FEED_CARD_CAROUSEL_THUMB, active && FEED_CARD_CAROUSEL_THUMB_ACTIVE]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            {imageUri ? (
                <CachedImage
                    source={{ uri: imageUri }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                    onError={() => (primaryUri ? setPrimaryFailed(true) : setPosterFailed(true))}
                />
            ) : (
                <View style={styles.thumbPlaceholder}>
                    <Icon
                        name={item.type === 'video' ? 'videocam-outline' : 'image-outline'}
                        size={20}
                        color="rgba(255,255,255,0.6)"
                    />
                </View>
            )}
            {item.type === 'video' ? (
                <View style={styles.vidBadge}>
                    <Text style={styles.vidBadgeText}>VID</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

export default function FeedMediaCarouselThumbs({ items, post, activeIndex, onSelect }: Props) {
    if (items.length <= 1) return null;

    return (
        <View style={FEED_CARD_CAROUSEL_WRAP}>
            <View style={FEED_CARD_CAROUSEL_HEADER}>
                <Text style={FEED_CARD_CAROUSEL_TITLE}>Carousel</Text>
                <Text style={FEED_CARD_CAROUSEL_COUNT}>
                    {activeIndex + 1} / {items.length}
                </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={FEED_CARD_CAROUSEL_RAIL}>
                {items.map((item, index) => (
                    <CarouselThumb
                        key={`thumb-${index}`}
                        item={item}
                        post={post}
                        index={index}
                        items={items}
                        active={index === activeIndex}
                        onPress={() => onSelect(index)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    thumbImg: {
        width: '100%',
        height: '100%',
    },
    thumbPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(148,163,184,0.18)',
    },
    vidBadge: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    vidBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
});
