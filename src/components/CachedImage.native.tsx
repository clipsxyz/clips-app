import React from 'react';
import { Image, type ImageProps, type ImageURISource } from 'react-native';

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
export default function CachedImage(props: ImageProps) {
    const { source, ...rest } = props;
    return <Image {...rest} source={cachedSource(source)} fadeDuration={0} />;
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