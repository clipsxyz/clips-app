import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { updateAuthProfile } from '../api/client';
import { setAvatarForHandle } from '../api/users';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { uploadFileFromUri } from './uploadFileNative';

function isLocalDeviceUri(uri: string): boolean {
  const raw = String(uri || '').trim();
  if (!raw) return false;
  return /^(file:|content:|ph:|data:)/i.test(raw) || raw.startsWith('/');
}

/**
 * Upload an on-device profile photo to Laravel and persist `avatar_url`.
 * Signup used to fire this in the background after leaving Login, so the
 * photo never landed on the user row and the feed showed initials.
 */
export async function persistLocalAvatarToLaravel(
  handle: string | undefined,
  localUri: string | undefined,
): Promise<string | undefined> {
  const uri = String(localUri || '').trim();
  if (!handle || !uri || !isLaravelApiEnabled() || !isLocalDeviceUri(uri)) {
    return undefined;
  }
  try {
    const upload = await uploadFileFromUri(uri, 'image/jpeg', 'profile-avatar.jpg');
    const remote = upload.fileUrl || upload.url;
    if (!remote) return undefined;
    await updateAuthProfile({ avatar_url: remote });
    const hosted = resolvePublicMediaUrl(remote) || remote;
    setAvatarForHandle(handle, hosted);
    return hosted;
  } catch (err) {
    console.warn('[persistLocalAvatarToLaravel] failed', err);
    return undefined;
  }
}
