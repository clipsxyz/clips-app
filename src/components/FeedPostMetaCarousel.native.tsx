import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { FEED_UI } from '../constants/feedUiTokens';
import type { FeedPostMetadataItem } from '../utils/feedPostMeta';

type Props = {
    items: FeedPostMetadataItem[];
    overlaid?: boolean;
    align?: 'left' | 'right';
};

function iconName(type: FeedPostMetadataItem['type']): string {
    switch (type) {
        case 'location':
            return 'location-outline';
        case 'venue':
            return 'home-outline';
        case 'landmark':
            return 'business-outline';
        default:
            return 'time-outline';
    }
}

export default function FeedPostMetaCarousel({ items, overlaid, align = 'left' }: Props) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
    }, [items.map((m) => m.label).join('|')]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(() => {
            setIndex((i) => (i + 1) % items.length);
        }, 3000);
        return () => clearInterval(t);
    }, [items.length]);

    const current = items[index];
    if (!current) return null;

    const textColor = overlaid ? 'rgba(255,255,255,0.9)' : '#9CA3AF';
    const iconColor = overlaid ? 'rgba(255,255,255,0.85)' : '#9CA3AF';

    return (
        <View style={[styles.wrap, align === 'right' && styles.wrapRight]}>
            <Icon name={iconName(current.type)} size={FEED_UI.type.metaIcon} color={iconColor} />
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
                {current.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: 140,
        minHeight: FEED_UI.type.metaIcon,
    },
    wrapRight: {
        alignSelf: 'flex-end',
    },
    // Web: `text-[10px]` — optically bumped with action icons
    label: {
        fontSize: FEED_UI.type.meta,
        fontWeight: '600',
        flexShrink: 1,
        letterSpacing: -0.1,
    },
});
