import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { updateAuthProfile } from '../api/client';
import { setAvatarForHandle } from '../api/users';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { uploadFileFromUri } from './uploadFileNative';

export function isLocalDeviceUri(uri: string): boolean {
  const raw = String(uri || '').trim();
  if (!raw) return false;
  // Laravel public disk paths — not an on-device file.
  if (/^\/storage\/(uploads|avatars)\b/i.test(raw)) return false;
  return /^(file:|content:|ph:|data:)/i.test(raw) || raw.startsWith('/');
}

function toPersistableAvatarUrl(remote: string): string {
  const raw = String(remote || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith('/storage/')) {
      return parsed.pathname;
    }
  } catch {
    /* relative or data URI */
  }
  return raw;
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
    const persistUrl = toPersistableAvatarUrl(remote);
    await updateAuthProfile({ avatar_url: persistUrl });
    const hosted = resolvePublicMediaUrl(persistUrl) || persistUrl;
    setAvatarForHandle(handle, hosted);
    return hosted;
  } catch (err) {
    console.warn('[persistLocalAvatarToLaravel] failed', err);
    return undefined;
  }
}
