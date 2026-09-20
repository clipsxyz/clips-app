import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';
import CachedImage from './CachedImage.native';
import { resolveAvatarImageUri } from '../api/users';
import { prefetchUserProfile, prefetchStoryGroup } from '../utils/prefetchNative';
import {
    STORIES_24_AVATAR_RING_COLORS,
    STORIES_24_AVATAR_RING_SEEN,
} from '../constants/stories24Ring';

const RING_PAD = 2;

export default function Avatar({
    src,
    name,
    size = 'md',
    hasStory = false,
    hasUnviewedStory = false,
    onClick,
    handle,
}: AvatarProps) {
    const { dim, fontSize } = resolveAvatarDimensions(size);
    const initials = getAvatarInitials(name);
    const handleHint =
        handle || (typeof name === 'string' && name.includes('@') ? name : undefined);
    const imageUri = resolveAvatarImageUri(src, handleHint);
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = Boolean(imageUri) && !imageFailed;
    const showRing = hasStory || hasUnviewedStory;
    const unviewed = Boolean(hasUnviewedStory);
    const pulse = useRef(new Animated.Value(0.28)).current;

    useEffect(() => {
        setImageFailed(false);
    }, [imageUri]);

    useEffect(() => {
        if (!unviewed) {
            pulse.stopAnimation();
            pulse.setValue(0.28);
            return;
        }
        let loop: Animated.CompositeAnimation | null = null;
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (!mounted || enabled) return;
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0.22,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ]),
            );
            loop.start();
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            loop?.stop();
            loop = null;
            if (enabled) {
                pulse.setValue(0.55);
                return;
            }
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0.22,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ]),
            );
            loop.start();
        });
        return () => {
            mounted = false;
            loop?.stop();
            sub.remove();
        };
    }, [pulse, unviewed]);

    const warmNextScreen = () => {
        if (handleHint) {
            prefetchUserProfile(handleHint);
            if (showRing) prefetchStoryGroup(handleHint);
        }
    };

    const inner = (
        <View style={[styles.innerClip, { width: dim, height: dim, borderRadius: dim / 2 }]}>
            {showImage ? (
                <CachedImage
                    uri={imageUri}
                    width={dim}
                    height={dim}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    recyclingKey={imageUri || undefined}
                    onError={() => setImageFailed(true)}
                    priority="high"
                />
            ) : null}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    styles.initialsWrap,
                    showImage ? styles.initialsHidden : null,
                ]}
            >
                <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
            </View>
        </View>
    );

    const ringSize = dim + RING_PAD * 2;
    const body = showRing ? (
        <View
            style={[
                styles.ring,
                {
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                    padding: RING_PAD,
                },
            ]}
        >
            {unviewed ? (
                <LinearGradient
                    colors={[...STORIES_24_AVATAR_RING_COLORS]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.ringSeen]} />
            )}
            {unviewed ? (
                <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.ringPulseFill, { opacity: pulse }]}
                />
            ) : null}
            {inner}
        </View>
    ) : (
        inner
    );

    const rootStyle: StyleProp<ViewStyle> = [
        styles.root,
        { width: showRing ? ringSize : dim, height: showRing ? ringSize : dim },
    ];

    if (onClick) {
        return (
            <Pressable
                onPress={() => onClick()}
                onPressIn={warmNextScreen}
                style={({ pressed }) => [rootStyle, pressed && styles.pressed]}
                accessibilityRole="button"
            >
                {body}
            </Pressable>
        );
    }

    return <View style={rootStyle}>{body}</View>;
}

const styles = StyleSheet.create({
    root: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.85,
    },
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ringSeen: {
        backgroundColor: STORIES_24_AVATAR_RING_SEEN,
    },
    ringPulseFill: {
        backgroundColor: '#FFFFFF',
    },
    innerClip: {
        overflow: 'hidden',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsWrap: {
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsHidden: {
        opacity: 0,
    },
    initialsText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
