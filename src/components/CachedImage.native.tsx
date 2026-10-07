import React from 'react';
import { Image, StyleSheet, View, type ImageProps, type ImageURISource } from 'react-native';

/**
 * Shared cached image for feed media and avatars.
 *
 * Caching strategy (no native dependency — this is a pure React Native app, and neither
 * expo-image nor react-native-fast-image can autolink into the Android build):
 *  - Android: the default Fresco pipeline already caches every image to memory + disk.
 *    The only flicker source on scroll-back is Fresco's 300ms default fade-in on
 *    re-attach, which `fadeDuration={0}` removes.
 *  - iOS: NSURLCache is told to use cache-before-network (`force-cache`), so a previously
 *    loaded avatar/thumbnail is served from memory/disk without even a revalidation
 *    round-trip.
 */
/**
 * `pointerEvents` is a View prop — RN's `Image` no longer accepts it — so when it is
 * requested we put the layout + hit-testing on a wrapping View and pin the image to it.
 */
export type CachedImageProps = ImageProps & {
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
};

export default function CachedImage(props: CachedImageProps) {
    const { source, pointerEvents, ...rest } = props;
    const image = <Image {...rest} source={cachedSource(source)} fadeDuration={0} />;
    if (!pointerEvents) return image;
    return (
        <View style={rest.style} pointerEvents={pointerEvents}>
            <Image {...rest} style={StyleSheet.absoluteFill} source={cachedSource(source)} fadeDuration={0} />
        </View>
    );
}

function cachedSource(source: ImageProps['source']): ImageProps['source'] {
    if (Array.isArray(source)) {
        return source.map((item) => withForceCache(item));
    }
    if (source && typeof source === 'object' && 'uri' in source) {
        return withForceCache(source as ImageURISource);
    }
    return source;
}

function withForceCache(src: ImageURISource): ImageURISource {
    if (!src?.uri) return src;
    return { ...src, cache: 'force-cache' };
}