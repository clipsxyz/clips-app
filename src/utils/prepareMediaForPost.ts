import { uploadFile } from '../api/client';
import { isMockMode } from '../api/apiMode';
import { captureVideoFrameDataUrl } from './captureVideoFrame';

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

function isHostedHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function needsHostedUpload(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  if (value.startsWith('blob:') || value.startsWith('data:') || value.startsWith('file:')) return true;
  return !isHostedHttpUrl(value);
}

function extensionForMime(mime: string, fallback: 'jpg' | 'webm'): string {
  const type = mime.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime')) return 'mov';
  return fallback;
}

async function urlToFile(mediaUrl: string, mediaType: 'image' | 'video'): Promise<File> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const mime = blob.type || (mediaType === 'video' ? 'video/webm' : 'image/jpeg');
  const ext = extensionForMime(mime, mediaType === 'video' ? 'webm' : 'jpg');
  return new File([blob], `${mediaType}-${Date.now()}.${ext}`, { type: mime });
}

async function uploadMediaUrlToBackend(mediaUrl: string, mediaType: 'image' | 'video'): Promise<string> {
  const file = await urlToFile(mediaUrl, mediaType);
  const uploadResult = await uploadFile(file);
  const uploadedUrl = uploadResult?.fileUrl || uploadResult?.url;
  const uploadSucceeded = uploadResult?.success !== false;
  if (uploadSucceeded && typeof uploadedUrl === 'string' && isHostedHttpUrl(uploadedUrl)) {
    return uploadedUrl;
  }
  throw new Error(uploadResult?.error || 'Upload failed');
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

async function hostedUrlOrThrow(url: string, mediaType: 'image' | 'video'): Promise<string> {
  if (isHostedHttpUrl(url)) return url;
  return uploadMediaUrlToBackend(url, mediaType);
}

export async function prepareMediaForPost({
  mediaUrl,
  mediaType,
  useBackendUpload = true,
  generatePoster = true,
}: PrepareSingleMediaArgs): Promise<PrepareSingleMediaResult> {
  const isVideo = mediaType === 'video' || (!mediaType && !mediaUrl.startsWith('data:image'));
  const liveUpload = useBackendUpload && !isMockMode();
  let persistentMediaUrl = mediaUrl;
  let videoPosterUrl: string | undefined;

  if (isVideo && generatePoster) {
    try {
      videoPosterUrl = await captureVideoFrameDataUrl(mediaUrl);
    } catch (error) {
      console.warn('prepareMediaForPost: poster capture failed', error);
    }
  }

  if (liveUpload && needsHostedUpload(mediaUrl)) {
    persistentMediaUrl = await uploadMediaUrlToBackend(mediaUrl, isVideo ? 'video' : 'image');
  } else if (!liveUpload && mediaUrl.startsWith('blob:') && !isVideo) {
    persistentMediaUrl = await blobUrlToDataUrl(mediaUrl);
  }

  if (liveUpload && videoPosterUrl && needsHostedUpload(videoPosterUrl)) {
    try {
      videoPosterUrl = await uploadMediaUrlToBackend(videoPosterUrl, 'image');
    } catch (error) {
      console.warn('prepareMediaForPost: poster upload failed', error);
      videoPosterUrl = undefined;
    }
  } else if (liveUpload && videoPosterUrl && !isHostedHttpUrl(videoPosterUrl)) {
    videoPosterUrl = undefined;
  }

  if (liveUpload && persistentMediaUrl && needsHostedUpload(persistentMediaUrl)) {
    throw new Error('Media must be uploaded to a public URL before posting.');
  }

  return { mediaUrl: persistentMediaUrl, videoPosterUrl };
}

export async function prepareMediaItemsForPost(items: MediaItemInput[]): Promise<{
  items: MediaItemInput[];
  videoPosterUrl?: string;
}> {
  const liveUpload = !isMockMode();
  const normalizedItems = await Promise.all(
    items.map(async (item) => {
      if (item.type === 'text' || !item.url) return item;
      if (liveUpload && needsHostedUpload(item.url)) {
        const url = await hostedUrlOrThrow(item.url, item.type === 'video' ? 'video' : 'image');
        return { ...item, url };
      }
      if (item.url.startsWith('blob:') && item.type === 'image') {
        const dataUrl = await blobUrlToDataUrl(item.url);
        return { ...item, url: dataUrl };
      }
      return item;
    }),
  );

  const firstVideoForPoster = normalizedItems.find((item) => item.type === 'video');
  let videoPosterUrl: string | undefined;
  if (firstVideoForPoster?.url) {
    try {
      videoPosterUrl = await captureVideoFrameDataUrl(firstVideoForPoster.url);
      if (liveUpload && videoPosterUrl && needsHostedUpload(videoPosterUrl)) {
        videoPosterUrl = await uploadMediaUrlToBackend(videoPosterUrl, 'image');
      } else if (liveUpload && videoPosterUrl && !isHostedHttpUrl(videoPosterUrl)) {
        videoPosterUrl = undefined;
      }
    } catch (error) {
      console.warn('prepareMediaItemsForPost: poster capture/upload failed', error);
      videoPosterUrl = undefined;
    }
  }

  return { items: normalizedItems, videoPosterUrl };
}
