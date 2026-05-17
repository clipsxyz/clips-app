import type { InstantFilterName } from './instantFiltersNative';
import { transcodeVideoForUploadNative } from './transcodeVideoForUploadNative';

/**
 * Re-encode with filter + Instagram delivery settings (single FFmpeg pass).
 */
export async function applyInstantFilterToVideo(
    inputUri: string,
    filterName: InstantFilterName,
): Promise<string> {
    return transcodeVideoForUploadNative(inputUri, { filterName });
}
