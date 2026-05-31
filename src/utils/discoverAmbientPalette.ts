export type DiscoverAmbientVariant = 'discover' | 'goldChrome';

export type AmbientPalette = {
    wavePrimary: string;
    waveMid: string;
    waveDeep: string;
    wave2Primary: string;
    wave2Mid: string;
    wave2End: string;
};

export const DISCOVER_PALETTE: AmbientPalette = {
    wavePrimary: '#d91b5c',
    waveMid: '#201138',
    waveDeep: '#0b0711',
    wave2Primary: 'rgba(217, 27, 92, 0.35)',
    wave2Mid: 'rgba(32, 17, 56, 0.2)',
    wave2End: 'rgba(11, 7, 17, 0)',
};

/** Stories 24 — gold + chrome (matches rail border gradient). */
export const GOLD_CHROME_PALETTE: AmbientPalette = {
    wavePrimary: '#f6e27a',
    waveMid: '#1a1530',
    waveDeep: '#0b0711',
    wave2Primary: 'rgba(212, 175, 55, 0.42)',
    wave2Mid: 'rgba(191, 197, 204, 0.28)',
    wave2End: 'rgba(11, 7, 17, 0)',
};

export function getAmbientPalette(variant: DiscoverAmbientVariant): AmbientPalette {
    return variant === 'goldChrome' ? GOLD_CHROME_PALETTE : DISCOVER_PALETTE;
}

export type AmbientWaveGeometry = {
    wave1: { x: number; y: number; radius: number };
    wave2: { x: number; y: number; radius: number };
};

/** Web DiscoverAmbientCanvas: +0.006 per requestAnimationFrame tick. */
export const DISCOVER_AMBIENT_TIME_STEP = 0.006;
/** Nominal ms between web rAF ticks (~60fps). */
export const DISCOVER_AMBIENT_MS_PER_STEP = 1000 / 60;

/** Map wall-clock ms to web ambient `time` (matches 60fps rAF accumulation). */
export function discoverAmbientTimeFromElapsedMs(elapsedMs: number): number {
    'worklet';
    return (elapsedMs / DISCOVER_AMBIENT_MS_PER_STEP) * DISCOVER_AMBIENT_TIME_STEP;
}

/** Shared wave positions — used by web canvas and native SVG ambient. */
export function getDiscoverAmbientWaveGeometry(
    width: number,
    height: number,
    time: number,
): AmbientWaveGeometry {
    'worklet';
    /** Scale drift for card-sized embeds (Stories 24 rail, feed cards). Full screens stay at 1. */
    const motionScale = Math.min(1, width / 380);
    const waveX = width * 0.2 + Math.sin(time * 1.5) * 100 * motionScale;
    const waveY = height * 0.8 + Math.cos(time * 2) * 120 * motionScale;
    const radius = Math.max(width, height) * 0.85;
    const wave2X = width * 0.65 + Math.cos(time * 1.1) * 70 * motionScale;
    const wave2Y = height * 0.55 + Math.sin(time * 1.6) * 80 * motionScale;
    return {
        wave1: { x: waveX, y: waveY, radius },
        wave2: { x: wave2X, y: wave2Y, radius: radius * 0.55 },
    };
}

export function drawDiscoverAmbientWave(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    palette: AmbientPalette,
) {
    ctx.clearRect(0, 0, width, height);

    const { wave1, wave2 } = getDiscoverAmbientWaveGeometry(width, height, time);

    const gradient = ctx.createRadialGradient(wave1.x, wave1.y, 10, wave1.x, wave1.y, wave1.radius);
    gradient.addColorStop(0, palette.wavePrimary);
    gradient.addColorStop(0.4, palette.waveMid);
    gradient.addColorStop(1, palette.waveDeep);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const gradient2 = ctx.createRadialGradient(wave2.x, wave2.y, 0, wave2.x, wave2.y, wave2.radius);
    gradient2.addColorStop(0, palette.wave2Primary);
    gradient2.addColorStop(0.5, palette.wave2Mid);
    gradient2.addColorStop(1, palette.wave2End);

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
}
