import { uploadFile } from '../api/client';
import { captureVideoFrameDataUrl } from './captureVideoFrame';
import { constrainImageToInstagramDataUrl } from './imageDimensions';

type MediaKind = 'image' | 'video' | 'text';

type MediaItemInput = {
  url: string;
  type: MediaKind;
  duration?: number;
  effects?: Array<any>;
  text?: string;
  textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string };
};

type PrepareSingleMediaArgs = {
  mediaUrl: string;
  mediaType?: 'image' | 'video' | null;
  useBackendUpload?: boolean;
  appOrigin?: string;
  generatePoster?: boolean;
};

type PrepareSingleMediaResult = {
  mediaUrl: string;
  videoPosterUrl?: string;
};

function isConnectionError(error: any): boolean {
  const msg = String(error?.message || '');
  return (
    error?.name === 'ConnectionRefused' ||
    msg.includes('CONNECTION_REFUSED') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network error') ||
    (error?.name === 'TypeError' && msg.includes('fetch'))
  );
}

async function uploadVideoUrlToBackend(mediaUrl: string): Promise<string> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
  const uploadResult = await uploadFile(file);
  const uploadedUrl = uploadResult?.fileUrl || uploadResult?.url;
  const uploadSucceeded = uploadResult?.success !== false;
  if (uploadSucceeded && uploadedUrl) {
    return uploadedUrl;
  }
  throw new Error(uploadResult?.error || 'Upload failed');
}

export async function prepareMediaForPost({
  mediaUrl,
  mediaType,
  useBackendUpload = true,
  appOrigin,
  generatePoster = true,
}: PrepareSingleMediaArgs): Promise<PrepareSingleMediaResult> {
  const isVideo = mediaType === 'video' || !mediaType;
  let persistentMediaUrl = mediaUrl;
  let videoPosterUrl: string | undefined;

  if (isVideo && generatePoster) {
    videoPosterUrl = await captureVideoFrameDataUrl(mediaUrl);
  }

  if (mediaUrl.startsWith('blob:') && isVideo && useBackendUpload) {
    try {
      persistentMediaUrl = await uploadVideoUrlToBackend(mediaUrl);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
    }
  } else if (isVideo && useBackendUpload && appOrigin && mediaUrl.startsWith(appOrigin)) {
    try {
      persistentMediaUrl = await uploadVideoUrlToBackend(mediaUrl);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
    }
  } else if (mediaUrl.startsWith('blob:') && !isVideo) {
    persistentMediaUrl = await constrainImageToInstagramDataUrl(mediaUrl);
  }

  return { mediaUrl: persistentMediaUrl, videoPosterUrl };
}

export async function prepareMediaItemsForPost(items: MediaItemInput[]): Promise<{
  items: MediaItemInput[];
  videoPosterUrl?: string;
}> {
  const normalizedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.url?.startsWith('blob:')) return item;
      if (item.type === 'image') {
        const constrained = await constrainImageToInstagramDataUrl(item.url);
        return { ...item, url: constrained };
      }
      return item;
    }),
  );

  const firstVideoForPoster = normalizedItems.find((item) => item.type === 'video');
  const videoPosterUrl = firstVideoForPoster?.url
    ? await captureVideoFrameDataUrl(firstVideoForPoster.url)
    : undefined;

  return { items: normalizedItems, videoPosterUrl };
}

