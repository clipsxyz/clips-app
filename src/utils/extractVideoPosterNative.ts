import { executeFfmpeg, makeSiblingOutputPath, toFfmpegPath, toFileUri } from './ffmpegNative';

/** Extract a single JPEG frame from a local video (fallback when view-shot capture is unavailable). */
export async function extractVideoPosterFrame(
    videoUri: string,
    timeSec = 0,
): Promise<string> {
    const inputPath = toFfmpegPath(videoUri);
    const outputPath = makeSiblingOutputPath(videoUri, 'poster', 'jpg');
    const seek = Math.max(0, Number(timeSec) || 0).toFixed(2);
    const command = [
        '-y',
        `-ss ${seek}`,
        `-i "${inputPath}"`,
        '-frames:v 1',
        '-q:v 2',
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}
