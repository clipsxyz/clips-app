import React from 'react';
import { FiSmartphone } from 'react-icons/fi';

/**
 * Full-screen prompt when a touch-first device is in landscape.
 * Mobile browsers (especially iOS Safari) often cannot lock orientation via JS;
 * this keeps the experience portrait-only in practice.
 */
export default function PortraitEnforcer() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const landscapeMq = window.matchMedia('(orientation: landscape)');
    const coarseMq = window.matchMedia('(pointer: coarse)');

    const sync = () => {
      const touchFirst = coarseMq.matches;
      const landscape = landscapeMq.matches;
      setShow(touchFirst && landscape);
    };

    sync();
    landscapeMq.addEventListener('change', sync);
    coarseMq.addEventListener('change', sync);
    window.addEventListener('resize', sync);

    return () => {
      landscapeMq.removeEventListener('change', sync);
      coarseMq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white"
      role="alert"
      aria-live="polite"
    >
      <FiSmartphone className="h-16 w-16 shrink-0 text-white/90 rotate-90" aria-hidden />
      <p className="max-w-xs text-lg font-semibold leading-snug">Please use Gazetteer in portrait mode</p>
      <p className="max-w-xs text-sm text-white/60">Rotate your phone upright to continue.</p>
    </div>
  );
}
