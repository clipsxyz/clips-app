type NativeMediaType = 'image' | 'video' | null;

type PrepareNativeMediaArgs = {
  mediaUrl: string | null;
  mediaType: NativeMediaType;
};

type PrepareNativeMediaResult = {
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  videoPosterUrl?: string;
};

/**
 * Native placeholder to keep post creation entry points aligned with web.
 * RN can later plug in transcoding / thumbnail generation here without
 * touching screen-level create flows.
 */
export async function prepareMediaForPostNative({
  mediaUrl,
  mediaType,
}: PrepareNativeMediaArgs): Promise<PrepareNativeMediaResult> {
  if (!mediaUrl || !mediaType) {
    return {};
  }

  const normalizedUrl = mediaUrl.trim();
  if (!normalizedUrl) {
    return {};
  }

  return {
    mediaUrl: normalizedUrl,
    mediaType,
    videoPosterUrl: undefined,
  };
}

