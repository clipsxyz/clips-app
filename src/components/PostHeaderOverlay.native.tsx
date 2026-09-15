import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { timeAgo } from '../utils/timeAgo';
import { ox } from '../constants/nativeOpticalScale';

export type PostCarouselMeta = {
    venue?: string;
    time?: string;
    landmark?: string;
};

type CarouselItem = {
    key: 'location' | 'venue' | 'landmark' | 'time';
    label: string;
    /** Feed switch target when tapped; null for non-navigable items (e.g. time). */
    feedFilter: 'location' | 'venue' | 'landmark' | null;
};

type PostOverlaySource = Pick<Post, 'locationLabel' | 'venue' | 'landmark' | 'createdAt'> & {
    carousel_meta?: PostCarouselMeta | null;
    carouselMeta?: PostCarouselMeta | null;
};

type Props = {
    locationLabel?: string | null;
    carouselMeta?: PostCarouselMeta | null;
    /** When carouselMeta is omitted, derive venue/time from the post (incl. carousel_meta). */
    post?: PostOverlaySource | null;
    onLocationPress?: (
        label: string,
        filterType?: 'location' | 'venue' | 'landmark',
    ) => void;
    /** Post options (burger) — sits top-right of the media. */
    onOverflowPress?: () => void;
};

function resolveCarouselMeta(
    carouselMeta: PostCarouselMeta | null | undefined,
    post: Props['post'],
): PostCarouselMeta | null {
    return carouselMeta || post?.carouselMeta || post?.carousel_meta || null;
}

/** Left broadcast badge slides: location → venue → landmark → time. */
function buildCarouselItems(
    locationLabel: string | null | undefined,
    carouselMeta: PostCarouselMeta | null | undefined,
    post: Props['post'],
): CarouselItem[] {
    const items: CarouselItem[] = [];
    const location = String(locationLabel || post?.locationLabel || '').trim();
    if (location && location !== 'Unknown Location') {
        items.push({ key: 'location', label: location, feedFilter: 'location' });
    }
    const meta = resolveCarouselMeta(carouselMeta, post);
    const venue = String(meta?.venue || post?.venue || '').trim();
    if (venue) items.push({ key: 'venue', label: venue, feedFilter: 'venue' });
    const landmark = String(meta?.landmark || post?.landmark || '').trim();
    if (landmark && landmark !== venue) {
        items.push({ key: 'landmark', label: landmark, feedFilter: 'landmark' });
    }
    let time = String(meta?.time || '').trim();
    if (!time && post?.createdAt != null) {
        const ts =
            typeof post.createdAt === 'string' ? parseInt(post.createdAt, 10) : post.createdAt;
        if (typeof ts === 'number' && !Number.isNaN(ts)) {
            time = timeAgo(ts);
        }
    }
    if (time) items.push({ key: 'time', label: time, feedFilter: null });
    return items;
}

/**
 * Broadcast-style left badge that carousels location / venue / landmark / time.
 */
export default function PostHeaderOverlay({
    locationLabel,
    carouselMeta,
    post,
    onLocationPress,
    onOverflowPress,
}: Props) {
    const items = useMemo(
        () => buildCarouselItems(locationLabel, carouselMeta, post),
        [
            locationLabel,
            carouselMeta,
            post?.locationLabel,
            post?.venue,
            post?.landmark,
            post?.createdAt,
            post?.carouselMeta,
            post?.carousel_meta,
        ],
    );
    const itemsKey = items.map((i) => `${i.key}:${i.label}`).join('|');
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
    }, [itemsKey]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(() => {
            setIndex((i) => (i + 1) % items.length);
        }, 3000);
        return () => clearInterval(t);
    }, [items.length, itemsKey]);

    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 0.35,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    const active = items[index] ?? items[0] ?? null;
    if (!active && !onOverflowPress) return null;

    const canPress = Boolean(onLocationPress && active?.feedFilter);

    return (
        <View style={styles.row} pointerEvents="box-none">
            {active ? (
                <Pressable
                    key={`${active.key}-${index}`}
                    style={styles.locationBadge}
                    onPress={() => {
                        if (!onLocationPress || !active.feedFilter) return;
                        onLocationPress(active.label, active.feedFilter);
                    }}
                    disabled={!canPress}
                    hitSlop={6}
                    accessibilityRole={canPress ? 'button' : undefined}
                    accessibilityLabel={
                        canPress ? `Switch feed to ${active.label}` : active.label
                    }
                >
                    <View style={styles.liveDotWrap}>
                        <Animated.View
                            style={[
                                styles.liveDotHalo,
                                {
                                    opacity: pulse,
                                    transform: [
                                        {
                                            scale: pulse.interpolate({
                                                inputRange: [0.35, 1],
                                                outputRange: [1.8, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                        <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
                    </View>
                    <Text style={styles.locationText} numberOfLines={1}>
                        {active.label.toUpperCase()}
                    </Text>
                </Pressable>
            ) : (
                <View style={styles.spacer} />
            )}

            {onOverflowPress ? (
                <Pressable
                    onPress={onOverflowPress}
                    style={styles.overflowBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Post options"
                >
                    <Icon name="list-outline" size={ox(18)} color="#FFFFFF" />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: ox(10),
        paddingTop: ox(10),
        gap: ox(8),
    },
    spacer: {
        flexShrink: 1,
        minWidth: 0,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        maxWidth: '72%',
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
        borderRadius: ox(999),
        backgroundColor: 'rgba(18, 24, 27, 0.85)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    liveDotWrap: {
        width: ox(12),
        height: ox(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDotHalo: {
        position: 'absolute',
        width: ox(10),
        height: ox(10),
        borderRadius: ox(999),
        backgroundColor: 'rgba(0, 242, 254, 0.45)',
    },
    liveDot: {
        width: ox(8),
        height: ox(8),
        borderRadius: ox(999),
        backgroundColor: '#00f2fe',
    },
    locationText: {
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: ox(10),
        fontWeight: '800',
        letterSpacing: 1.4,
    },
    overflowBtn: {
        minWidth: ox(36),
        minHeight: ox(36),
        borderRadius: ox(999),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(18, 24, 27, 0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.22)',
    },
});
