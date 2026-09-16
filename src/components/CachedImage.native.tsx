import React, { useEffect } from 'react';
import {
    Image,
    StyleSheet,
    type ImageStyle,
    type StyleProp,
    type ImageResizeMode,
    type ImageSourcePropType,
} from 'react-native';

type Props = {
    uri?: string | null;
    source?: ImageSourcePropType;
    style?: StyleProp<ImageStyle>;
    /** Explicit layout hint for decode / memory budgeting (px). */
    width?: number;
    height?: number;
    contentFit?: 'cover' | 'contain' | 'stretch' | 'center';
    recyclingKey?: string;
    onError?: () => void;
    onLoad?: () => void;
    accessibilityLabel?: string;
    priority?: 'low' | 'normal' | 'high';
};

function toResizeMode(fit: Props['contentFit']): ImageResizeMode {
    if (fit === 'contain') return 'contain';
    if (fit === 'stretch') return 'stretch';
    if (fit === 'center') return 'center';
    return 'cover';
}

/**
 * Shared remote image helper.
 * Uses RN Image disk/memory cache + prefetch, with explicit width/height for decode budgeting.
 * Swap the implementation to expo-image / FastImage once native modules are linked.
 */
export default function CachedImage({
    uri,
    source,
    style,
    width,
    height,
    contentFit = 'cover',
    onError,
    onLoad,
    accessibilityLabel,
}: Props) {
    const resolvedUri =
        uri ||
        (source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source
            ? String((source as { uri?: string }).uri || '')
            : '');

    useEffect(() => {
        if (!resolvedUri || !/^https?:\/\//i.test(resolvedUri)) return;
        void Image.prefetch(resolvedUri).catch(() => {});
    }, [resolvedUri]);

    const resolvedSource: ImageSourcePropType | null = source
        ? source
        : resolvedUri
          ? {
                uri: resolvedUri,
                ...(width && height ? { width, height } : null),
            }
          : null;

    if (!resolvedSource) return null;

    return (
        <Image
            source={resolvedSource}
            style={[width && height ? { width, height } : null, style]}
            resizeMode={toResizeMode(contentFit)}
            onError={onError}
            onLoad={onLoad}
            accessibilityLabel={accessibilityLabel}
            // Android: avoid full-res decode when we know display size.
            {...(width && height
                ? ({
                      // @ts-expect-error RN Android-only
                      resizeMethod: 'resize',
                  } as object)
                : null)}
        />
    );
}

export function prefetchCachedImages(uris: Array<string | null | undefined>): void {
    for (const raw of uris) {
        const u = String(raw || '').trim();
        if (!u || !/^https?:\/\//i.test(u)) continue;
        void Image.prefetch(u).catch(() => {});
    }
}
