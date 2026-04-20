import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    StyleSheet,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';

export default function Avatar({
    src,
    name,
    size = 'md',
    hasStory = false,
    onClick,
}: AvatarProps) {
    const { dim, fontSize } = resolveAvatarDimensions(size);
    const initials = getAvatarInitials(name);
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = src && !imageFailed;

    const inner = (
        <View style={[styles.innerClip, { width: dim, height: dim, borderRadius: dim / 2 }]}>
            {showImage ? (
                <Image
                    source={{ uri: src }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                    onError={() => setImageFailed(true)}
                />
            ) : null}
            <View
                style={[
                    StyleSheet.absoluteFillObject,
                    styles.initialsWrap,
                    showImage ? styles.initialsHidden : null,
                ]}
            >
                <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
            </View>
        </View>
    );

    const body = hasStory ? (
        <LinearGradient
            colors={['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3', '#d4af37']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[
                styles.storyRing,
                {
                    width: dim + 4,
                    height: dim + 4,
                    borderRadius: (dim + 4) / 2,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
            ]}
        >
            {inner}
        </LinearGradient>
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
    storyRing: {
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
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
