/**
 * On-device H.264/AAC MP4 before upload. Laravel stores this file as-is
 * (no second transcode), so this pass is the quality the feed plays.
 *
 * - Long edge capped at 1080px, aspect ratio preserved (no 720p downscale)
 * - 30 fps cap, CRF 20 with an 8 Mbps ceiling, AAC 128 kbps
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
    /** Lower CRF is higher quality. 20 stays sharp at 1080p without a tiny bitrate cap. */
    videoCrf: 20,
    videoMaxrate: '8000k',
    videoBufsize: '12000k',
    audioCodec: 'aac',
    audioBitrate: '128k',
    audioSampleRate: 44100,
    audioChannels: 2,
} as const;

/** FFmpegKit splits unescaped commas, including inside a quoted -vf graph. */
export function escapeFfmpegFilterCommas(filter: string): string {
    return filter.replace(/,/g, '\\,');
}

/**
 * Video filter chain: downscale → even dimensions → fps cap → optional color grade.
 */
export function buildInstagramDeliveryVideoFilterChain(colorFilter?: string | null): string {
    const max = INSTAGRAM_UPLOAD_DELIVERY.maxLongEdgePx;
    const fps = INSTAGRAM_UPLOAD_DELIVERY.maxFrameRate;
    const parts = [
        // One comma, inside min(), so ffmpeg-kit's argument splitter stays intact.
        // Width cap at 1080 keeps vertical clips at 1080x1920 and landscape at 1080-wide.
        `scale='min(${max},iw)':-2:flags=bicubic`,
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
        `-crf ${d.videoCrf}`,
        `-maxrate ${d.videoMaxrate}`,
        `-bufsize ${d.videoBufsize}`,
        `-pix_fmt ${d.pixelFormat}`,
        '-threads 0',
        `-c:a ${d.audioCodec}`,
        `-b:a ${d.audioBitrate}`,
        `-ar ${d.audioSampleRate}`,
        `-ac ${d.audioChannels}`,
        '-movflags +faststart',
        '-map_metadata -1',
    ];
}
