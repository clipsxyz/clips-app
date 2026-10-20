import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ImageFullscreenView } from '../components/ImageFullscreenModal.native';
import {
    clearImageFullscreenLaunch,
    getImageFullscreenLaunch,
    subscribeImageFullscreen,
} from '../utils/imageFullscreenLaunchNative';

/**
 * Native Stack route for the fullscreen media viewer.
 *
 * Registered with `presentation: 'transparentModal'` + `animation: 'fade'` so the entire
 * viewer (backdrop, media, header chrome, close "X") is dismissed as a single native unit —
 * no JS-orchestrated collapse that could leave ghost elements behind.
 *
 * The displayed post and every action handler come from the in-memory bridge
 * (`imageFullscreenLaunchNative`), which the host screen seeds immediately before
 * `navigation.navigate('ImageFullscreenModal', …)`.
 */
export default function ImageFullscreenScreen() {
    const navigation = useNavigation();
    const payload = useSyncExternalStore(
        subscribeImageFullscreen,
        getImageFullscreenLaunch,
        getImageFullscreenLaunch,
    );

    // Hold the host's close handler so it runs exactly once, after the native pop has
    // finished (component unmount) — the host clears its own feed-suspension flag there.
    const closeHandlerRef = useRef<(() => void) | undefined>(undefined);
    if (payload?.handlers?.onClose) {
        closeHandlerRef.current = payload.handlers.onClose;
    }

    useEffect(() => {
        return () => {
            closeHandlerRef.current?.();
            clearImageFullscreenLaunch();
        };
    }, []);

    if (!payload) return null;

    const { onClose: _onClose, ...viewHandlers } = payload.handlers;

    return (
        <ImageFullscreenView
            post={payload.post}
            initialIndex={payload.startIndex}
            {...viewHandlers}
            onRequestClose={() => navigation.goBack()}
        />
    );
}
