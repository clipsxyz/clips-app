import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';
import PassportTravelingBorder from './PassportTravelingBorder.native';
import CachedImage from './CachedImage.native';
import { resolveAvatarImageUri } from '../api/users';
import { prefetchUserProfile, prefetchStoryGroup } from '../utils/prefetchNative';

export default function Avatar({
    src,
    name,
    size = 'md',
    hasStory = false,
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

    useEffect(() => {
        setImageFailed(false);
    }, [imageUri]);

    const warmNextScreen = () => {
        if (handleHint) {
            prefetchUserProfile(handleHint);
            if (hasStory) prefetchStoryGroup(handleHint);
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

    const ringSize = dim + 4;
    const body = hasStory ? (
        <PassportTravelingBorder
            borderRadius={ringSize / 2}
            borderWidth={2}
            style={{ width: ringSize, height: ringSize }}
        >
            {inner}
        </PassportTravelingBorder>
    ) : (
        inner
    );

    const rootStyle: StyleProp<ViewStyle> = [
        styles.root,
        { width: hasStory ? dim + 4 : dim, height: hasStory ? dim + 4 : dim },
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
    innerClip: {
        overflow: 'hidden',
        backgroundColor: '#0b0b0f',
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
