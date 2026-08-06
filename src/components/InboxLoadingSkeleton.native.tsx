import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { ox } from '../constants/nativeOpticalScale';

const TAB_WIDTHS = [72, 58, 52, 62] as const;
const ROW_TITLE_WIDTHS = ['48%', '36%', '58%', '42%', '51%', '33%', '45%'] as const;
const ROW_SUB_WIDTHS = ['68%', '54%', '72%', '40%', '61%', '55%', '47%'] as const;

function ShimmerBlock({
    style,
    shimmer,
}: {
    style: object;
    shimmer: Animated.AnimatedInterpolation<number>;
}) {
    return (
        <Animated.View
            style={[
                styles.bone,
                style,
                {
                    opacity: shimmer,
                },
            ]}
        />
    );
}

/**
 * Quiet inbox placeholder — mirrors real tabs + conversation rows with a soft shimmer.
 */
export default function InboxLoadingSkeleton({ rows = 7 }: { rows?: number }) {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    // Stagger each row slightly via different opacity ranges for a wave feel.
    const baseShimmer = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.22, 0.48],
    });

    return (
        <View style={styles.wrap} accessibilityLabel="Loading messages">
            {/* Story rail placeholders */}
            <View style={styles.storiesRail}>
                {Array.from({ length: 5 }, (_, i) => (
                    <View key={`story-${i}`} style={styles.storyItem}>
                        <ShimmerBlock style={styles.storyRing} shimmer={baseShimmer} />
                    </View>
                ))}
            </View>

            {/* Tabs — same footprint as live Inbox */}
            <View style={styles.tabs}>
                {TAB_WIDTHS.map((w, i) => (
                    <ShimmerBlock
                        key={`tab-${i}`}
                        style={[styles.tabBone, { width: ox(w) }, i === 0 ? styles.tabBoneActive : null]}
                        shimmer={baseShimmer}
                    />
                ))}
            </View>

            <View style={styles.list}>
                {Array.from({ length: rows }, (_, i) => {
                    const rowShimmer = pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.18 + (i % 3) * 0.04, 0.42 + (i % 3) * 0.06],
                    });
                    return (
                        <View key={`row-${i}`} style={styles.row}>
                            <ShimmerBlock style={styles.avatar} shimmer={rowShimmer} />
                            <View style={styles.content}>
                                <ShimmerBlock
                                    style={[styles.title, { width: ROW_TITLE_WIDTHS[i % ROW_TITLE_WIDTHS.length] }]}
                                    shimmer={rowShimmer}
                                />
                                <ShimmerBlock
                                    style={[styles.subtitle, { width: ROW_SUB_WIDTHS[i % ROW_SUB_WIDTHS.length] }]}
                                    shimmer={rowShimmer}
                                />
                            </View>
                            <ShimmerBlock style={styles.time} shimmer={rowShimmer} />
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        width: '100%',
    },
    bone: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    storiesRail: {
        flexDirection: 'row',
        paddingHorizontal: ox(12),
        paddingBottom: ox(10),
        paddingTop: ox(4),
        gap: ox(12),
    },
    storyItem: {
        alignItems: 'center',
    },
    storyRing: {
        width: ox(52),
        height: ox(52),
        borderRadius: ox(26),
    },
    tabs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        paddingHorizontal: ox(12),
        paddingBottom: ox(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    tabBone: {
        height: ox(12),
        borderRadius: ox(6),
    },
    tabBoneActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    list: {
        paddingTop: ox(4),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: ox(8),
        paddingHorizontal: ox(6),
        paddingVertical: ox(12),
        gap: ox(10),
    },
    avatar: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(22),
    },
    content: {
        flex: 1,
        minWidth: 0,
        gap: ox(8),
    },
    title: {
        height: ox(11),
        borderRadius: ox(5),
    },
    subtitle: {
        height: ox(9),
        borderRadius: ox(4),
    },
    time: {
        width: ox(28),
        height: ox(8),
        borderRadius: ox(4),
        alignSelf: 'flex-start',
        marginTop: ox(2),
    },
});
