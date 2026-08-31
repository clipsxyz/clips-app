import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    type SharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';

type Props = {
    isLiked: boolean;
    onToggleLike: () => void;
    likeCount: number;
    size?: number;
    color?: string;
    countColor?: string;
    onCountPress?: () => void;
    showCount?: boolean;
    disabled?: boolean;
};

const GLOW_WHITE = 'rgba(255, 255, 255, 0.45)';
const GLOW_SOFT = 'rgba(255, 255, 255, 0.28)';
const SPARK_COLORS = [
    '#FFFFFF',
    'rgba(255,255,255,0.9)',
    'rgba(255,255,255,0.7)',
    '#FFFFFF',
    'rgba(255,255,255,0.85)',
    'rgba(255,255,255,0.6)',
    '#FFFFFF',
    'rgba(255,255,255,0.75)',
] as const;

function WhiteHeartIcon({ size }: { size: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </Svg>
    );
}

function Spark({
    burst,
    angleDeg,
    dist,
    color,
    size,
}: {
    burst: SharedValue<number>;
    angleDeg: number;
    dist: number;
    color: string;
    size: number;
}) {
    const rad = (angleDeg * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.12, 0.55, 1], [0, 1, 0.8, 0]),
        transform: [
            { translateX: interpolate(burst.value, [0, 1], [0, tx]) },
            { translateY: interpolate(burst.value, [0, 1], [0, ty]) },
            { scale: interpolate(burst.value, [0, 0.18, 1], [0.25, 1.15, 0.15]) },
        ],
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.spark,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                },
                style,
            ]}
        />
    );
}

/**
 * Like morph: thumbs-up → View Profile sea-glass heart → filled thumbs-up.
 * Root is exactly `size`×`size` so it lines up with the other engagement icons.
 */
export default function AnimatedLikeButton({
    isLiked,
    onToggleLike,
    likeCount,
    size = 24,
    color = '#FFFFFF',
    countColor,
    onCountPress,
    showCount = true,
    disabled = false,
}: Props) {
    const iconScale = useSharedValue(1);
    const showHeart = useSharedValue(0);
    const burst = useSharedValue(0);
    const playingRef = useRef(false);
    const isLikedRef = useRef(isLiked);
    isLikedRef.current = isLiked;
    const [showingHeart, setShowingHeart] = useState(false);
    const [displayLiked, setDisplayLiked] = useState(isLiked);

    const sparks = useMemo(() => {
        const dist = size * 0.68;
        return SPARK_COLORS.map((sparkColor, i) => ({
            color: sparkColor,
            angleDeg: -15 + i * 45,
            dist: dist * (i % 2 === 0 ? 1 : 0.8),
        }));
    }, [size]);

    useEffect(() => {
        if (playingRef.current) return;
        setDisplayLiked(isLiked);
        setShowingHeart(false);
        showHeart.value = 0;
        iconScale.value = 1;
        burst.value = 0;
    }, [isLiked, iconScale, showHeart, burst]);

    const finishMorph = useCallback(() => {
        playingRef.current = false;
        setShowingHeart(false);
        setDisplayLiked(isLikedRef.current);
        burst.value = 0;
    }, [burst]);

    const revealHeart = useCallback(() => {
        setShowingHeart(true);
    }, []);

    const hideHeart = useCallback(() => {
        setShowingHeart(false);
        setDisplayLiked(true);
    }, []);

    const playLikeMorph = useCallback(() => {
        playingRef.current = true;
        cancelAnimation(iconScale);
        cancelAnimation(showHeart);
        cancelAnimation(burst);
        iconScale.value = 1;
        showHeart.value = 0;
        burst.value = 0;
        setShowingHeart(false);
        setDisplayLiked(false);

        burst.value = withTiming(1, { duration: 880, easing: Easing.out(Easing.cubic) });

        iconScale.value = withSequence(
            withTiming(0, { duration: 110 }, (finished) => {
                if (!finished) return;
                showHeart.value = 1;
                runOnJS(revealHeart)();
            }),
            withSpring(1.28, { damping: 9, stiffness: 220, mass: 0.55 }),
            withDelay(
                480,
                withTiming(0, { duration: 110 }, (finished) => {
                    if (!finished) return;
                    showHeart.value = 0;
                    runOnJS(hideHeart)();
                }),
            ),
            withSpring(1, { damping: 12, stiffness: 180, mass: 0.6 }, (finished) => {
                if (finished) runOnJS(finishMorph)();
            }),
        );
    }, [burst, finishMorph, hideHeart, iconScale, revealHeart, showHeart]);

    const onPress = useCallback(() => {
        if (disabled || playingRef.current) return;
        if (!isLiked) {
            playLikeMorph();
            onToggleLike();
            return;
        }
        setDisplayLiked(false);
        setShowingHeart(false);
        showHeart.value = 0;
        burst.value = 0;
        iconScale.value = withSequence(
            withTiming(0.82, { duration: 80 }),
            withSpring(1, { damping: 14, stiffness: 220 }),
        );
        onToggleLike();
    }, [burst, disabled, iconScale, isLiked, onToggleLike, playLikeMorph, showHeart]);

    const thumbStyle = useAnimatedStyle(() => ({
        opacity: 1 - showHeart.value,
        transform: [{ scale: iconScale.value }],
    }));
    const heartStyle = useAnimatedStyle(() => ({
        opacity: showHeart.value,
        transform: [{ scale: iconScale.value }],
    }));
    const seaGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.1, 0.45, 1], [0, 0.95, 0.4, 0]),
        transform: [{ scale: interpolate(burst.value, [0, 1], [0.35, 1.8]) }],
    }));
    const inkGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.16, 0.5, 1], [0, 0.65, 0.25, 0]),
        transform: [{ scale: interpolate(burst.value, [0, 1], [0.5, 1.45]) }],
    }));

    const glowSize = size * 2.2;
    const sparkDot = Math.max(4, Math.round(size * 0.2));

    const icon = (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
            accessibilityState={{ selected: isLiked, disabled }}
        >
            <View style={{ width: size, height: size }} pointerEvents="none" collapsable={false}>
                <Animated.View
                    style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, thumbStyle]}
                    pointerEvents="none"
                >
                    <FeedLikeThumbsIcon
                        size={size}
                        filled={displayLiked && !showingHeart}
                        color={color}
                    />
                </Animated.View>
                <Animated.View style={[styles.overlay, heartStyle]} pointerEvents="none">
                    <View style={styles.heartNudge}>
                        <WhiteHeartIcon size={size} />
                    </View>
                </Animated.View>
                <View style={styles.fxHost} pointerEvents="none">
                    <View style={[styles.fxOrigin, { left: size / 2, top: size / 2 }]}>
                        <Animated.View
                            style={[
                                styles.glow,
                                {
                                    width: glowSize,
                                    height: glowSize,
                                    borderRadius: glowSize / 2,
                                    backgroundColor: GLOW_WHITE,
                                    marginLeft: -glowSize / 2,
                                    marginTop: -glowSize / 2,
                                },
                                seaGlowStyle,
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.glow,
                                {
                                    width: glowSize * 0.7,
                                    height: glowSize * 0.7,
                                    borderRadius: (glowSize * 0.7) / 2,
                                    backgroundColor: GLOW_SOFT,
                                    marginLeft: -(glowSize * 0.7) / 2,
                                    marginTop: -(glowSize * 0.7) / 2,
                                },
                                inkGlowStyle,
                            ]}
                        />
                        {sparks.map((spark) => (
                            <Spark
                                key={spark.color + spark.angleDeg}
                                burst={burst}
                                angleDeg={spark.angleDeg}
                                dist={spark.dist}
                                color={spark.color}
                                size={sparkDot}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (!showCount) return icon;

    return (
        <View style={styles.row}>
            {icon}
            <TouchableOpacity
                onPress={onCountPress || onPress}
                disabled={disabled && !onCountPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${likeCount} likes`}
            >
                <Text style={[styles.count, { color: countColor || color }]}>{likeCount}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 3,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartNudge: {
        marginTop: -10,
    },
    fxHost: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'visible',
    },
    fxOrigin: {
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'visible',
    },
    glow: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    spark: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    count: {
        fontSize: 12,
        fontWeight: '400',
        fontVariant: ['tabular-nums'],
        minWidth: 28,
    },
});

export { AnimatedLikeButton };
