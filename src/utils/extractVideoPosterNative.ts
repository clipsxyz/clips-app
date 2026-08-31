import { executeFfmpeg, makeSiblingOutputPath, toFfmpegPath, toFileUri } from './ffmpegNative';

/** Square poster size — center-cropped so 9:16 thumbs keep faces in frame. */
const POSTER_SIZE = 320;

function posterSeekSeconds(timeSec: number): string {
    const requested = Math.max(0, Number(timeSec) || 0);
    // t=0 is often a black or letterboxed first packet; nudge into the clip.
    const seek = requested < 0.05 ? 0.15 : requested;
    return seek.toFixed(2);
}

/** Scale up to cover a square, then crop equally from all sides (centered). */
export function videoPosterCenterCropFilter(size = POSTER_SIZE): string {
    const even = Math.max(2, Math.floor(size / 2) * 2);
    return `scale=${even}:${even}:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=${even}:${even},setsar=1`;
}

/** Extract a single JPEG frame from a local video (fallback when view-shot capture is unavailable). */
export async function extractVideoPosterFrame(
    videoUri: string,
    timeSec = 0,
): Promise<string> {
    const inputPath = toFfmpegPath(videoUri);
    const outputPath = makeSiblingOutputPath(videoUri, 'poster', 'jpg');
    const seek = posterSeekSeconds(timeSec);
    const vf = videoPosterCenterCropFilter();
    const command = [
        '-y',
        `-ss ${seek}`,
        `-i "${inputPath}"`,
        `-vf "${vf}"`,
        '-frames:v 1',
        '-q:v 2',
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}
