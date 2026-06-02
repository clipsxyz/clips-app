import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
export type CarouselThumbItem = {
    url: string;
    type: 'image' | 'video' | 'text';
};

type Props = {
    items: CarouselThumbItem[];
    activeIndex: number;
    onSelect: (index: number) => void;
};

export default function FeedMediaCarouselThumbs({ items, activeIndex, onSelect }: Props) {
    if (items.length <= 1) return null;

    return (
        <View style={styles.wrap}>
            <View style={styles.header}>
                <Text style={styles.title}>CAROUSEL</Text>
                <Text style={styles.count}>
                    {activeIndex + 1} / {items.length}
                </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {items.map((item, index) => {
                    const active = index === activeIndex;
                    return (
                        <TouchableOpacity
                            key={`thumb-${index}`}
                            style={[styles.thumb, active && styles.thumbActive]}
                            onPress={() => onSelect(index)}
                            activeOpacity={0.9}
                        >
                            {item.type === 'video' ? (
                                <View style={styles.thumbImgWrap}>
                                    <Image source={{ uri: item.url }} style={styles.thumbImg} />
                                    <View style={styles.vidBadge}>
                                        <Text style={styles.vidBadgeText}>VID</Text>
                                    </View>
                                </View>
                            ) : (
                                <Image source={{ uri: item.url }} style={styles.thumbImg} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: 'rgba(255,255,255,0.85)',
    },
    count: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    rail: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 4,
    },
    thumbImgWrap: {
        width: '100%',
        height: '100%',
    },
    thumb: {
        width: 56,
        height: 56,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    thumbActive: {
        borderColor: '#FFFFFF',
        borderWidth: 2,
    },
    thumbImg: {
        width: '100%',
        height: '100%',
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
