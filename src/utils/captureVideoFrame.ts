/**
 * Grab a JPEG data URL from a remote/local video URL (for thumbnails / collapse overlay).
 * May fail on CORS-blocked hosts — callers should handle undefined.
 */
export async function captureVideoFrameDataUrl(mediaUrl: string): Promise<string | undefined> {
    let v: HTMLVideoElement | null = null;
    try {
        const video = document.createElement('video');
        v = video;
        video.src = mediaUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error('VIDEO_LOAD_TIMEOUT')), 4000);
            const finish = (fn: () => void) => {
                window.clearTimeout(timer);
                fn();
            };
            video.addEventListener('loadeddata', () => finish(resolve), { once: true });
            video.addEventListener('error', () => finish(() => reject(new Error('VIDEO_LOAD_FAILED'))), { once: true });
        });
        try {
            video.currentTime = Math.min(0.1, Math.max(0, (video.duration || 0) / 10));
        } catch {
            /* ignore seek errors */
        }
        await new Promise<void>((resolve) => {
            video.addEventListener('seeked', () => resolve(), { once: true });
            window.setTimeout(resolve, 120);
        });
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(720, video.videoWidth);
            canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) return undefined;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.82);
        }
    } catch {
        /* ignore */
    } finally {
        if (v) {
            try {
                v.pause();
                v.removeAttribute('src');
                v.load();
            } catch {
                /* ignore */
            }
        }
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
