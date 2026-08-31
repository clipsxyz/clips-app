import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import CarouselSlideThumb from './CarouselSlideThumb.native';
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
                    return (
                        <TouchableOpacity
                            key={`thumb-${index}`}
                            style={[FEED_CARD_CAROUSEL_THUMB, active && FEED_CARD_CAROUSEL_THUMB_ACTIVE]}
                            onPress={() => onSelect(index)}
                            activeOpacity={0.9}
                        >
                            <CarouselSlideThumb
                                size={56}
                                uri={item.url}
                                type={item.type}
                                posterUrl={item.posterUrl}
                                thumbnailUrl={item.thumbnailUrl}
                                thumbnail_url={item.thumbnail_url}
                                allowPausedVideo
                            />
                            {item.type === 'video' ? (
                                <View style={styles.vidBadge} pointerEvents="none">
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
    vidBadge: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        zIndex: 2,
    },
    vidBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
});
