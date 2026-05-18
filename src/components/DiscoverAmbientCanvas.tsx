import { useEffect, useRef } from 'react';

const MAGENTA = '#d91b5c';
const INDIGO = '#201138';
const ABYSS = '#0b0711';

function drawWave(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
) {
    ctx.clearRect(0, 0, width, height);

    const waveX = width * 0.2 + Math.sin(time * 1.5) * 100;
    const waveY = height * 0.8 + Math.cos(time * 2) * 120;
    const radius = Math.max(width, height) * 0.85;

    const gradient = ctx.createRadialGradient(waveX, waveY, 10, waveX, waveY, radius);
    gradient.addColorStop(0, MAGENTA);
    gradient.addColorStop(0.4, INDIGO);
    gradient.addColorStop(1, ABYSS);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const wave2X = width * 0.65 + Math.cos(time * 1.1) * 70;
    const wave2Y = height * 0.55 + Math.sin(time * 1.6) * 80;
    const gradient2 = ctx.createRadialGradient(wave2X, wave2Y, 0, wave2X, wave2Y, radius * 0.55);
    gradient2.addColorStop(0, 'rgba(217, 27, 92, 0.35)');
    gradient2.addColorStop(0.5, 'rgba(32, 17, 56, 0.2)');
    gradient2.addColorStop(1, 'rgba(11, 7, 17, 0)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
}

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
};

export default function DiscoverAmbientCanvas({ fixed = true, lockViewport = false }: DiscoverAmbientCanvasProps) {
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

            drawWave(ctx, width, height, reducedMotion || paused ? timeRef.current : timeRef.current);
        };

        resize();
        window.addEventListener('resize', resize);
        if (!lockViewport) {
            window.visualViewport?.addEventListener('resize', resize);
            window.visualViewport?.addEventListener('scroll', resize);
        }

        const onVisibility = () => {
            paused = document.hidden;
            if (paused) drawWave(ctx, width, height, timeRef.current);
        };

        document.addEventListener('visibilitychange', onVisibility);

        if (reducedMotion) {
            drawWave(ctx, width, height, 0);
            return () => {
                window.removeEventListener('resize', resize);
                if (!lockViewport) {
                    window.visualViewport?.removeEventListener('resize', resize);
                    window.visualViewport?.removeEventListener('scroll', resize);
                }
                document.removeEventListener('visibilitychange', onVisibility);
            };
        }

        const animate = () => {
            if (!paused && width > 0 && height > 0) {
                timeRef.current += 0.006;
                drawWave(ctx, width, height, timeRef.current);
            }
            frameRef.current = requestAnimationFrame(animate);
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            if (!lockViewport) {
                window.visualViewport?.removeEventListener('resize', resize);
                window.visualViewport?.removeEventListener('scroll', resize);
            }
            document.removeEventListener('visibilitychange', onVisibility);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [fixed, lockViewport]);

    const positionClass = fixed
        ? lockViewport
            ? 'fixed inset-0 z-0 h-[100svh] min-h-[100svh]'
            : 'fixed inset-0 z-0'
        : 'absolute inset-0 z-0';

    return (
        <div className={`pointer-events-none overflow-hidden ${positionClass}`} aria-hidden>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className="discover-halftone-overlay absolute inset-0 z-[1]" />
        </div>
    );
}
