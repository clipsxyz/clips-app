import { executeFfmpeg, makeSiblingOutputPath, toFfmpegPath, toFileUri } from './ffmpegNative';
import { getFfmpegVideoFilter, type InstantFilterName } from './instantFiltersNative';
import {
    buildInstagramDeliveryEncodeArgs,
    buildInstagramDeliveryVideoFilterChain,
} from './instagramVideoDeliveryNative';
import { resolveLocalMediaUriForFfmpeg } from './resolveLocalMediaUriForFfmpegNative';

export type TranscodeVideoForUploadOptions = {
    /** Instant filter baked into the same pass as compression (Instagram-style single transcode). */
    filterName?: InstantFilterName | null;
    /** Cap output length (seconds from 0) so re-encode cannot exceed Stories/Feed limits. */
    maxDurationSec?: number;
};

/**
 * Pre-upload transcode: 720p / 30 fps / ultrafast H.264 + AAC MP4.
 * Optional color filter is applied in the same -vf chain (one encode pass).
 */
export async function transcodeVideoForUploadNative(
    inputUri: string,
    options: TranscodeVideoForUploadOptions = {},
): Promise<string> {
    const resolvedInput = await resolveLocalMediaUriForFfmpeg(inputUri);
    const colorFilter = options.filterName ? getFfmpegVideoFilter(options.filterName) : null;
    const vf = buildInstagramDeliveryVideoFilterChain(colorFilter);
    const inputPath = toFfmpegPath(resolvedInput);
    const outputPath = makeSiblingOutputPath(resolvedInput, 'upload', 'mp4');
    const encodeArgs = buildInstagramDeliveryEncodeArgs();
    const maxDur =
        typeof options.maxDurationSec === 'number' && options.maxDurationSec > 0
            ? Math.floor(options.maxDurationSec)
            : null;
    const command = [
        '-y',
        `-i "${inputPath}"`,
        ...(maxDur != null ? [`-t ${maxDur}`] : []),
        `-vf "${vf}"`,
        ...encodeArgs,
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}

/**
 * Downscale stills before upload so camera JPEGs stay under the Laravel payload cap.
 * Max edge 1080px; `-q:v 5` ≈ ~0.8 JPEG quality (lower q = higher quality for mjpeg).
 */
export async function compressImageForUploadNative(inputUri: string): Promise<string> {
    const resolvedInput = await resolveLocalMediaUriForFfmpeg(inputUri);
    const inputPath = toFfmpegPath(resolvedInput);
    const outputPath = makeSiblingOutputPath(resolvedInput, 'upload', 'jpg');
    const command = [
        '-y',
        `-i "${inputPath}"`,
        `-vf "scale='min(1080,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:flags=fast_bilinear"`,
        '-q:v 5',
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}
