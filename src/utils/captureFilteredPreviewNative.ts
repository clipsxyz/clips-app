import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function captureFilteredPreviewFromRef(
    viewRef: RefObject<View | null>,
): Promise<string> {
    if (!viewRef.current) {
        throw new Error('Preview is not ready for capture');
    }
    const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
    });
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
        return uri;
    }
    return `file://${uri}`;
}
