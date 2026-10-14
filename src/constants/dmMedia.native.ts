import { ox } from './nativeOpticalScale';

/**
 * Unified DM media frame so shared-post cards and inline video messages
 * share the same aspect ratio and max width inside a thread.
 */
export const DM_MEDIA_ASPECT_RATIO = 4 / 5;
export const DM_MEDIA_MAX_WIDTH = ox(280);
