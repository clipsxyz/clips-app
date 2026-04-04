/**
 * Web: request portrait lock where the platform allows (often only after a user gesture).
 * iOS Safari usually ignores lock entirely for normal tabs — use PortraitEnforcer overlay too.
 */
export function initPortraitLockWeb(): void {
  if (typeof window === 'undefined') return;

  const tryLock = () => {
    const o = window.screen?.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    if (o && typeof o.lock === 'function') {
      void o.lock('portrait').catch(() => {
        /* unsupported or not allowed yet */
      });
    }
  };

  tryLock();

  const onFirstGesture = () => {
    tryLock();
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
  };
  window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', onFirstGesture, { capture: true, passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryLock();
  });
}
