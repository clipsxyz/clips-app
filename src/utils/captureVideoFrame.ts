/**
 * Grab a JPEG data URL from a remote/local video URL (for thumbnails / collapse overlay).
 * May fail on CORS-blocked hosts — callers should handle undefined.
 */
export async function captureVideoFrameDataUrl(mediaUrl: string): Promise<string | undefined> {
    try {
        const v = document.createElement('video');
        v.src = mediaUrl;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'metadata';
        await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve();
            const onError = () => reject(new Error('VIDEO_LOAD_FAILED'));
            v.addEventListener('loadeddata', onLoaded, { once: true });
            v.addEventListener('error', onError, { once: true });
        });
        try {
            v.currentTime = Math.min(0.1, Math.max(0, (v.duration || 0) / 10));
        } catch {
            /* ignore seek errors */
        }
        await new Promise<void>((resolve) => {
            v.addEventListener('seeked', () => resolve(), { once: true });
            window.setTimeout(resolve, 120);
        });
        if (v.videoWidth > 0 && v.videoHeight > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(720, v.videoWidth);
            canvas.height = Math.round((canvas.width / v.videoWidth) * v.videoHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) return undefined;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.82);
        }
    } catch {
        /* ignore */
    }
    return undefined;
}

/** Snapshot the current frame from an in-DOM video element (e.g. story player). */
export function captureVideoFrameFromElement(v: HTMLVideoElement): string | undefined {
    if (v.videoWidth <= 0 || v.videoHeight <= 0) return undefined;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(720, v.videoWidth);
        canvas.height = Math.round((canvas.width / v.videoWidth) * v.videoHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
        return undefined;
    }
}
