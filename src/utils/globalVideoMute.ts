const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';
export const GLOBAL_VIDEO_MUTED_EVENT = 'clips:globalVideoMutedChanged';

/** In-session mute. Page load / refresh always starts muted and ignores a saved unmuted value. */
let sessionMuted: boolean | null = null;

function persistMuted(muted: boolean): void {
  try {
    localStorage.setItem(GLOBAL_VIDEO_MUTED_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function getGlobalVideoMuted(): boolean {
  if (sessionMuted == null) {
    sessionMuted = true;
    persistMuted(true);
  }
  return sessionMuted;
}

export function setGlobalVideoMuted(nextMuted: boolean): void {
  sessionMuted = nextMuted;
  persistMuted(nextMuted);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GLOBAL_VIDEO_MUTED_EVENT, {
        detail: { muted: nextMuted },
      })
    );
  }
}
