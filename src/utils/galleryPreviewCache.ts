/**
 * Hold the selected gallery files in memory across navigation to GalleryPreviewPage.
 * Blob URLs are origin-bound and can be revoked when the source page unmounts,
 * so we keep the Blobs and create new URLs on the preview page.
 *
 * Supports up to CAROUSEL_MAX items for Instagram-style carousel posts.
 */

const CAROUSEL_MAX = 10;

type CachedGalleryItem = {
  blob: Blob;
  mediaType: 'image' | 'video';
  videoDuration: number;
};

let cachedItems: CachedGalleryItem[] | null = null;

/**
 * Store one or more gallery items for use on GalleryPreviewPage.
 *
 * Backwards-compatible:
 * - If called with a single Blob (legacy usage), wraps it in an array.
 * - If called with an array of items, stores up to CAROUSEL_MAX.
 */
export function setGalleryPreviewMedia(
  blobOrItems: Blob | CachedGalleryItem[],
  mediaType?: 'image' | 'video',
  videoDuration = 0
): void {
  if (Array.isArray(blobOrItems)) {
    cachedItems = blobOrItems.slice(0, CAROUSEL_MAX);
    return;
  }

  // Legacy single-item usage
  if (!mediaType) {
    throw new Error('mediaType is required when calling setGalleryPreviewMedia with a single Blob');
  }

  cachedItems = [
    {
      blob: blobOrItems,
      mediaType,
      videoDuration,
    },
  ];
}

export function getGalleryPreviewMedia(): CachedGalleryItem[] | null {
  if (!cachedItems || cachedItems.length === 0) return null;
  return cachedItems;
}

export function clearGalleryPreviewMedia(): void {
  cachedItems = null;
}
