const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';
export const GLOBAL_VIDEO_MUTED_EVENT = 'clips:globalVideoMutedChanged';

export function getGlobalVideoMuted(): boolean {
  try {
    const raw = localStorage.getItem(GLOBAL_VIDEO_MUTED_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function setGlobalVideoMuted(nextMuted: boolean): void {
  try {
    localStorage.setItem(GLOBAL_VIDEO_MUTED_KEY, nextMuted ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GLOBAL_VIDEO_MUTED_EVENT, {
        detail: { muted: nextMuted },
      })
    );
  }
}
