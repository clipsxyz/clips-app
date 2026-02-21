/**
 * Hold the selected gallery file in memory across navigation to GalleryPreviewPage.
 * Blob URLs are origin-bound and can be revoked when the source page unmounts,
 * so we keep the Blob and create a new URL on the preview page.
 */
let cachedBlob: Blob | null = null;
let cachedMediaType: 'image' | 'video' = 'video';
let cachedVideoDuration = 0;

export function setGalleryPreviewMedia(blob: Blob, mediaType: 'image' | 'video', videoDuration = 0): void {
  cachedBlob = blob;
  cachedMediaType = mediaType;
  cachedVideoDuration = videoDuration;
}

export function getGalleryPreviewMedia(): {
  blob: Blob;
  mediaType: 'image' | 'video';
  videoDuration: number;
} | null {
  if (!cachedBlob) return null;
  return {
    blob: cachedBlob,
    mediaType: cachedMediaType,
    videoDuration: cachedVideoDuration,
  };
}

export function clearGalleryPreviewMedia(): void {
  cachedBlob = null;
}
