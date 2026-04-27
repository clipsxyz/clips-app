const SHARE_RETURN_PATH_KEY = 'clips_public_share_return_path';

export function getPublicShareReturnPathKey(): string {
  return SHARE_RETURN_PATH_KEY;
}

export function buildPublicPostUrl(token?: string, fallbackPostId?: string): string {
  if (token) {
    return `${window.location.origin}/p/${token}`;
  }
  return `${window.location.origin}/post/${fallbackPostId ?? ''}`;
}

export function storePublicShareReturnPath(path: string): void {
  try {
    localStorage.setItem(SHARE_RETURN_PATH_KEY, path);
  } catch {
    // ignore storage failures
  }
}

export function consumePublicShareReturnPath(): string | null {
  try {
    const value = localStorage.getItem(SHARE_RETURN_PATH_KEY);
    if (!value) return null;
    localStorage.removeItem(SHARE_RETURN_PATH_KEY);
    return value;
  } catch {
    return null;
  }
}

