import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import CachedImage from './CachedImage.native';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';

/** White outline when there's an unviewed active story, subtle translucent otherwise. */
export const AVATAR_STORY_BORDER_WIDTH = 2;
export const AVATAR_STORY_BORDER_COLOR = '#FFFFFF';
export const AVATAR_IDLE_BORDER_COLOR = 'rgba(255, 255, 255, 0.15)';
/**
 * Default color of the gap band between the avatar photo and the ring. Matches the
 * feed card surface so the ring stands off cleanly (Instagram parity). Callers on a
 * different surface should pass `gapColor` to match their background.
 */
export const DEFAULT_AVATAR_GAP_COLOR = 'transparent';
export function avatarBorderColor(hasStory: boolean): string {
    return hasStory ? AVATAR_STORY_BORDER_COLOR : AVATAR_IDLE_BORDER_COLOR;
}

export default function Avatar({
    src,
    name,
    size = 'md',
    hasStory = false,
    hideBorder = false,
    borderWidth: borderWidthProp,
    cornerRadius,
    ringGap = 0,
    gapColor = DEFAULT_AVATAR_GAP_COLOR,
    ringColor,
    onClick,
}: AvatarProps) {
    const { dim, fontSize } = resolveAvatarDimensions(size);
    const initials = getAvatarInitials(name);
    const [imageFailed, setImageFailed] = useState(false);
    const resolvedSrc = src ? resolvePublicMediaUrl(src) || src : undefined;
    useEffect(() => {
        setImageFailed(false);
    }, [resolvedSrc]);
    const showImage = !!resolvedSrc && !imageFailed;

    // Full circle by default; an explicit `cornerRadius` opts into the squircle
    // shape used by the feed header / top-bar buttons.
    const outerRadius = cornerRadius != null ? cornerRadius : dim / 2;
    // Three concentric layers: Outer Ring (border) -> Gap (background colored) ->
    // Avatar image. The outer box stays exactly `dim` so every avatar shares the
    // same footprint; the border and the gap are both drawn INSIDE it, and each
    // inner radius recedes by exactly the inset it sits under — so the rounded
    // corners stay concentric at every layer with no distortion.
    const borderWidth = hideBorder ? 0 : borderWidthProp ?? AVATAR_STORY_BORDER_WIDTH;
    const gap = hideBorder ? 0 : Math.max(0, ringGap);
    const inset = borderWidth + gap;
    const innerDim = Math.max(0, dim - inset * 2);
    const innerRadius = Math.max(0, outerRadius - inset);
    // The gap band sits between the border and the image. Its radius recedes only
    // by the border width (it is still under the border, not under the gap).
    const gapRadius = Math.max(0, outerRadius - borderWidth);

    const inner = (
        <View
            style={[
                styles.innerClip,
                { width: innerDim, height: innerDim, borderRadius: innerRadius },
            ]}
        >
            {showImage ? (
                <CachedImage
                    source={{ uri: resolvedSrc }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    onError={() => setImageFailed(true)}
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

    const body = (
        <View
            style={[
                styles.ring,
                {
                    width: dim,
                    height: dim,
                    borderRadius: outerRadius,
                    borderWidth,
                    borderColor: hideBorder ? 'transparent' : ringColor ?? avatarBorderColor(hasStory),
                },
            ]}
        >
            {gap > 0 ? (
                <View
                    style={[
                        styles.gap,
                        {
                            width: dim - borderWidth * 2,
                            height: dim - borderWidth * 2,
                            borderRadius: gapRadius,
                            padding: gap,
                            backgroundColor: gapColor,
                        },
                    ]}
                >
                    {inner}
                </View>
            ) : (
                inner
            )}
        </View>
    );

    const rootStyle: StyleProp<ViewStyle> = [styles.root, { width: dim, height: dim }];

    if (onClick) {
        return (
            <Pressable
                onPress={() => onClick()}
                style={({ pressed }) => [rootStyle, pressed && styles.pressed]}
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
    },
    gap: {
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: 14,
        fontWeight: '700',
    },
});
