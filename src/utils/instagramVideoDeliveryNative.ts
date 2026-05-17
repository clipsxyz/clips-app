/**
 * Client-side delivery targets modeled on Instagram's upload pipeline:
 * - On device: transcode to H.264/AAC MP4 before upload (aggressive, mobile-oriented).
 * - Server/CDN may re-encode again; we match what the Instagram *app* sends upstream.
 *
 * References (public specs / creator docs, 2024–2026):
 * - H.264 + AAC in MP4, progressive download (`faststart`)
 * - Long edge capped at 1080px, aspect ratio preserved
 * - ~30 fps cap, ~3.5 Mbps video / 128 kbps AAC audio for HD-class output
 * - Portrait 9:16 (1080×1920), square 1:1, and 4:5 are display crops — we do not
 *   force a single aspect; we only bound resolution and bitrate like Instagram's scaler.
 */

export const INSTAGRAM_UPLOAD_DELIVERY = {
    container: 'mp4',
    maxLongEdgePx: 1080,
    maxFrameRate: 30,
    videoCodec: 'libx264',
    videoProfile: 'high',
    videoLevel: '4.0',
    pixelFormat: 'yuv420p',
    x264Preset: 'veryfast',
    /** Instagram HD feed/reels class target (~3.5–5 Mbps). */
    videoBitrate: '3500k',
    videoMaxrate: '3500k',
    videoBufsize: '7000k',
    audioCodec: 'aac',
    audioBitrate: '128k',
    audioSampleRate: 44100,
    audioChannels: 2,
} as const;

/**
 * Video filter chain: downscale → even dimensions → fps cap → optional color grade.
 */
export function buildInstagramDeliveryVideoFilterChain(colorFilter?: string | null): string {
    const max = INSTAGRAM_UPLOAD_DELIVERY.maxLongEdgePx;
    const fps = INSTAGRAM_UPLOAD_DELIVERY.maxFrameRate;
    const parts = [
        `scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease`,
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        `fps=${fps}`,
    ];
    if (colorFilter) {
        parts.push(colorFilter);
    }
    return parts.join(',');
}

export function buildInstagramDeliveryEncodeArgs(): string[] {
    const d = INSTAGRAM_UPLOAD_DELIVERY;
    return [
        `-c:v ${d.videoCodec}`,
        `-profile:v ${d.videoProfile}`,
        `-level ${d.videoLevel}`,
        `-preset ${d.x264Preset}`,
        `-b:v ${d.videoBitrate}`,
        `-maxrate ${d.videoMaxrate}`,
        `-bufsize ${d.videoBufsize}`,
        `-pix_fmt ${d.pixelFormat}`,
        '-map 0:v:0',
        '-map 0:a:0?',
        `-c:a ${d.audioCodec}`,
        `-b:a ${d.audioBitrate}`,
        `-ar ${d.audioSampleRate}`,
        `-ac ${d.audioChannels}`,
        '-movflags +faststart',
        '-map_metadata -1',
    ];
}
