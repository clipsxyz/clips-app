import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
    posterUrl?: string;
    thumbnailUrl?: string;
    thumbnail_url?: string;
};

function thumbUri(item: CarouselThumbItem): string | undefined {
    const poster = item.posterUrl || item.thumbnailUrl || item.thumbnail_url;
    if (item.type === 'video') return poster || undefined;
    return poster || item.url || undefined;
}

type Props = {
    items: CarouselThumbItem[];
    activeIndex: number;
    onSelect: (index: number) => void;
};

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
                {items.map((item, index) => {
                    const active = index === activeIndex;
                    const uri = thumbUri(item);
                    return (
                        <TouchableOpacity
                            key={`thumb-${index}`}
                            style={[FEED_CARD_CAROUSEL_THUMB, active && FEED_CARD_CAROUSEL_THUMB_ACTIVE]}
                            onPress={() => onSelect(index)}
                            activeOpacity={0.9}
                        >
                            {uri ? (
                                <Image source={{ uri }} style={styles.thumbImg} />
                            ) : (
                                <View style={styles.thumbFallback} />
                            )}
                            {item.type === 'video' ? (
                                <View style={styles.vidBadge}>
                                    <Text style={styles.vidBadgeText}>VID</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    thumbImgWrap: {
        width: '100%',
        height: '100%',
    },
    thumbImg: {
        width: '100%',
        height: '100%',
    },
    thumbFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: '#121212',
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
