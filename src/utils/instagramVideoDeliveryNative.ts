/**
 * On-device H.264/AAC MP4 before upload. Tuned for encode speed on phones
 * (ultrafast + 720p + capped bitrate) so posts stay small with no server transcode.
 *
 * - Long edge capped at 720px, aspect ratio preserved
 * - 30 fps cap, ~1.8 Mbps video / 96 kbps AAC
 */

export const INSTAGRAM_UPLOAD_DELIVERY = {
    container: 'mp4',
    maxLongEdgePx: 720,
    maxFrameRate: 30,
    videoCodec: 'libx264',
    videoProfile: 'main',
    videoLevel: '3.1',
    pixelFormat: 'yuv420p',
    x264Preset: 'ultrafast',
    /** 720p social target — small files, fast x264. */
    videoBitrate: '1800k',
    videoMaxrate: '1800k',
    videoBufsize: '3600k',
    audioCodec: 'aac',
    audioBitrate: '96k',
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
        `scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease:flags=fast_bilinear`,
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
        '-threads 0',
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
