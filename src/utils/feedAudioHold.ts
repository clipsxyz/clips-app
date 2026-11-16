export const FEED_AUDIO_HOLD_EVENT = 'clips:feedAudioHoldChanged';

let holds = 0;

export function isFeedAudioHeld(): boolean {
  return holds > 0;
}

function pausePageMedia(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('video, audio').forEach((el) => {
    try {
      (el as HTMLMediaElement).pause();
    } catch {
      /* ignore */
    }
  });
}

function dispatchHold(held: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEED_AUDIO_HOLD_EVENT, { detail: { held } }));
}

/** Pause newsfeed clips until the returned function runs. Nested calls stay quiet until the last one releases. */
export function holdFeedAudio(): () => void {
  holds += 1;
  if (holds === 1) {
    pausePageMedia();
    dispatchHold(true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) dispatchHold(false);
  };
}
