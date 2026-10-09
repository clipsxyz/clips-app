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
export function avatarBorderColor(hasStory: boolean): string {
    return hasStory ? AVATAR_STORY_BORDER_COLOR : AVATAR_IDLE_BORDER_COLOR;
}

export default function Avatar({
    src,
    name,
    size = 'md',
    hasStory = false,
    cornerRadius,
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
    // Outer circle/square is always `dim` so every avatar shares identical
    // dimensions; the 2px outline + 2px inner padding are uniform in both
    // story states and the inner radius stays concentric with the outer ring.
    const innerDim = Math.max(0, dim - AVATAR_STORY_BORDER_WIDTH * 2);
    const innerRadius = Math.max(0, outerRadius - AVATAR_STORY_BORDER_WIDTH);

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
                    borderWidth: AVATAR_STORY_BORDER_WIDTH,
                    borderColor: avatarBorderColor(hasStory),
                },
            ]}
        >
            {inner}
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
    innerClip: {
        overflow: 'hidden',
        backgroundColor: '#2A2F38',
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsWrap: {
        backgroundColor: '#2A2F38',
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
