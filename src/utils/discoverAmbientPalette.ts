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

export function drawDiscoverAmbientWave(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    palette: AmbientPalette,
) {
    ctx.clearRect(0, 0, width, height);

    const waveX = width * 0.2 + Math.sin(time * 1.5) * 100;
    const waveY = height * 0.8 + Math.cos(time * 2) * 120;
    const radius = Math.max(width, height) * 0.85;

    const gradient = ctx.createRadialGradient(waveX, waveY, 10, waveX, waveY, radius);
    gradient.addColorStop(0, palette.wavePrimary);
    gradient.addColorStop(0.4, palette.waveMid);
    gradient.addColorStop(1, palette.waveDeep);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const wave2X = width * 0.65 + Math.cos(time * 1.1) * 70;
    const wave2Y = height * 0.55 + Math.sin(time * 1.6) * 80;
    const gradient2 = ctx.createRadialGradient(wave2X, wave2Y, 0, wave2X, wave2Y, radius * 0.55);
    gradient2.addColorStop(0, palette.wave2Primary);
    gradient2.addColorStop(0.5, palette.wave2Mid);
    gradient2.addColorStop(1, palette.wave2End);

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
}
