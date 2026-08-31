import { useEffect, useRef } from 'react';
import {
    type DiscoverAmbientVariant,
    DISCOVER_AMBIENT_TIME_STEP,
    drawDiscoverAmbientWave,
    getAmbientPalette,
} from '../utils/discoverAmbientPalette';

function getViewportSize(lockLayoutViewport: boolean) {
    if (lockLayoutViewport) {
        return {
            width: Math.max(1, Math.round(window.innerWidth)),
            height: Math.max(1, Math.round(window.innerHeight)),
        };
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    return {
        width: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
        height: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
    };
}

type DiscoverAmbientCanvasProps = {
    /** Pin to the visual viewport (recommended for full-screen mobile pages). */
    fixed?: boolean;
    /** Keep full-screen gradient when the mobile keyboard opens (do not shrink to visualViewport). */
    lockViewport?: boolean;
    /** `goldChrome` — Stories 24 gold + silver. `passport` — night atlas for profiles. */
    variant?: DiscoverAmbientVariant;
};

export default function DiscoverAmbientCanvas({
    fixed = true,
    lockViewport = false,
    variant = 'discover',
}: DiscoverAmbientCanvasProps) {
    const palette = getAmbientPalette(variant);
    const halftoneClass =
        variant === 'goldChrome'
            ? 'gold-chrome-halftone-overlay'
            : variant === 'passport'
              ? 'passport-halftone-overlay'
              : 'discover-halftone-overlay';
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number | undefined>(undefined);
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let width = 0;
        let height = 0;
        let paused = document.hidden;

        const resize = () => {
            const size = fixed
                ? getViewportSize(lockViewport)
                : (() => {
                    const parent = canvas.parentElement;
                    return {
                        width: Math.max(1, parent?.clientWidth ?? window.innerWidth),
                        height: Math.max(1, parent?.clientHeight ?? window.innerHeight),
                    };
                })();

            width = size.width;
            height = size.height;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            drawDiscoverAmbientWave(ctx, width, height, timeRef.current, palette);
        };

        resize();
        window.addEventListener('resize', resize);
        if (!lockViewport) {
            window.visualViewport?.addEventListener('resize', resize);
            window.visualViewport?.addEventListener('scroll', resize);
        }

        // Sheet/card parents often grow after mount (e.g. likers load) without a window
        // resize — observe the parent so absolute canvases rematch content height.
        let parentObserver: ResizeObserver | undefined;
        if (!fixed && typeof ResizeObserver !== 'undefined') {
            const parent = canvas.parentElement;
            if (parent) {
                parentObserver = new ResizeObserver(() => {
                    resize();
                });
                parentObserver.observe(parent);
            }
        }

        const onVisibility = () => {
            paused = document.hidden;
            if (paused) drawDiscoverAmbientWave(ctx, width, height, timeRef.current, palette);
        };

        document.addEventListener('visibilitychange', onVisibility);

        const cleanupListeners = () => {
            window.removeEventListener('resize', resize);
            if (!lockViewport) {
                window.visualViewport?.removeEventListener('resize', resize);
                window.visualViewport?.removeEventListener('scroll', resize);
            }
            document.removeEventListener('visibilitychange', onVisibility);
            parentObserver?.disconnect();
        };

        if (reducedMotion) {
            drawDiscoverAmbientWave(ctx, width, height, 0, palette);
            return cleanupListeners;
        }

        const animate = () => {
            if (!paused && width > 0 && height > 0) {
                timeRef.current += DISCOVER_AMBIENT_TIME_STEP;
                drawDiscoverAmbientWave(ctx, width, height, timeRef.current, palette);
            }
            frameRef.current = requestAnimationFrame(animate);
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            cleanupListeners();
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [fixed, lockViewport, variant, palette]);

    const positionClass = fixed
        ? lockViewport
            ? 'fixed inset-0 z-0 h-[100svh] min-h-[100svh]'
            : 'fixed inset-0 z-0'
        : 'absolute inset-0 z-0';

    return (
        <div className={`pointer-events-none overflow-hidden ${positionClass}`} aria-hidden>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className={`${halftoneClass} absolute inset-0 z-[1]`} />
        </div>
    );
}
