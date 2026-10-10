import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import CachedImage from './CachedImage.native';
import { isVideoMediaUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import {
    FEED_CARD_CAROUSEL_COUNT,
    FEED_CARD_CAROUSEL_HEADER,
    FEED_CARD_CAROUSEL_RAIL,
    FEED_CARD_CAROUSEL_THUMB,
    FEED_CARD_CAROUSEL_THUMB_ACTIVE,
    FEED_CARD_CAROUSEL_TITLE,
    FEED_CARD_CAROUSEL_WRAP,
} from './FeedPageLayout.native';

export type CarouselThumbItem = {
    url: string;
    type: 'image' | 'video' | 'text';
    /** Server-generated poster for a video slide (any of these aliases). */
    posterUrl?: string | null;
    poster_url?: string | null;
    thumbnailUrl?: string | null;
    thumbnail_url?: string | null;
};

type Props = {
    items: CarouselThumbItem[];
    activeIndex: number;
    onSelect: (index: number) => void;
};

/**
 * A still image for one tile. Never return the MP4 URL — Android `Image` cannot decode
 * video and paints a black box. Order: explicit poster/thumbnail → the slide's own image
 * → a JPEG sitting next to the MP4 (`clip.mp4` → `clip.jpg`).
 */
function resolveThumbStillUri(item: CarouselThumbItem): string | undefined {
    const explicit =
        item.thumbnail_url || item.thumbnailUrl || item.poster_url || item.posterUrl;
    if (explicit && !isVideoMediaUri(explicit)) return String(explicit).trim() || undefined;

    if (item.type !== 'video' && item.url && !isVideoMediaUri(item.url)) {
        return item.url;
    }
    if (item.type === 'video') {
        return siblingJpegFromVideoUrl(item.url);
    }
    return undefined;
}

function CarouselThumb({
    item,
    active,
    onPress,
}: {
    item: CarouselThumbItem;
    active: boolean;
    onPress: () => void;
}) {
    const stillUri = resolveThumbStillUri(item);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setFailed(false);
    }, [stillUri]);

    const showImage = Boolean(stillUri) && !failed;

    return (
        <TouchableOpacity
            style={[FEED_CARD_CAROUSEL_THUMB, active && FEED_CARD_CAROUSEL_THUMB_ACTIVE]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            {showImage ? (
                <CachedImage
                    source={{ uri: stillUri as string }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <LinearGradient
                    colors={['#374151', '#1F2937']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.thumbFallback}
                >
                    <Icon
                        name={item.type === 'video' ? 'videocam' : 'image-outline'}
                        size={20}
                        color="rgba(255,255,255,0.75)"
                    />
                </LinearGradient>
            )}
            {item.type === 'video' ? (
                <View style={styles.vidBadge}>
                    <Text style={styles.vidBadgeText}>VID</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

export default function FeedMediaCarouselThumbs({ items, activeIndex, onSelect }: Props) {
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
    thumbFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
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
