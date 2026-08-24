import { executeFfmpeg, makeSiblingOutputPath, toFfmpegPath, toFileUri } from './ffmpegNative';
import { getFfmpegVideoFilter, type InstantFilterName } from './instantFiltersNative';
import {
    buildInstagramDeliveryEncodeArgs,
    buildInstagramDeliveryVideoFilterChain,
} from './instagramVideoDeliveryNative';

export type TranscodeVideoForUploadOptions = {
    /** Instant filter baked into the same pass as compression (Instagram-style single transcode). */
    filterName?: InstantFilterName | null;
};

/**
 * Pre-upload transcode: 720p / 30 fps / ultrafast H.264 + AAC MP4.
 * Optional color filter is applied in the same -vf chain (one encode pass).
 */
export async function transcodeVideoForUploadNative(
    inputUri: string,
    options: TranscodeVideoForUploadOptions = {},
): Promise<string> {
    const colorFilter = options.filterName ? getFfmpegVideoFilter(options.filterName) : null;
    const vf = buildInstagramDeliveryVideoFilterChain(colorFilter);
    const inputPath = toFfmpegPath(inputUri);
    const outputPath = makeSiblingOutputPath(inputUri, 'upload', 'mp4');
    const encodeArgs = buildInstagramDeliveryEncodeArgs();

    const command = [
        '-y',
        `-i "${inputPath}"`,
        `-vf "${vf}"`,
        ...encodeArgs,
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}

/**
 * Downscale stills before upload so camera JPEGs stay under the Laravel payload cap.
 */
export async function compressImageForUploadNative(inputUri: string): Promise<string> {
    const inputPath = toFfmpegPath(inputUri);
    const outputPath = makeSiblingOutputPath(inputUri, 'upload', 'jpg');
    const command = [
        '-y',
        `-i "${inputPath}"`,
        `-vf "scale='min(1080,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:flags=fast_bilinear"`,
        '-q:v 4',
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}
