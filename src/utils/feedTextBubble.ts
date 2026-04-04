import { getDmSentBubblePreference } from '../constants/dmImessageTheme';

export function expandShortHex(hex: string): string {
  let h = hex.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h}`;
}

/** Hex color stops from CSS `background` (solid or gradient) — useful for canvas rail previews. */
export function extractHexColorsFromCss(css: string): string[] {
  const raw = String(css).match(/#[0-9a-f]{3,8}\b/gi) || [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of raw) {
    const norm = expandShortHex(h);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/** Solid fill for speech tail — templates often use gradients; extract first hex (or rgb) or fall back to DM palette. */
export function resolveTextCardTailFill(backgroundCss: string, isFromViewer: boolean): string {
  const trimmed = String(backgroundCss).trim();
  if (/^#([0-9a-f]{3,8})$/i.test(trimmed)) {
    return expandShortHex(trimmed);
  }
  const hexStops = trimmed.match(/#[0-9a-f]{3,8}\b/gi);
  if (hexStops?.length) {
    return expandShortHex(hexStops[0]);
  }
  const rgb = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const r = Math.min(255, parseInt(rgb[1], 10));
    const g = Math.min(255, parseInt(rgb[2], 10));
    const b = Math.min(255, parseInt(rgb[3], 10));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return isFromViewer
    ? getDmSentBubblePreference() === 'green'
      ? '#34C759'
      : '#0A84FF'
    : '#3A3A3C';
}

/**
 * One “@” only: `username@location`. Uses the handle’s user@place segment when present;
 * if the handle has no @, appends post `locationLabel` when available.
 */
export function formatTextOnlyFeedByline(rawHandle: string, locationLabel?: string | null): string {
  let h = (rawHandle || '').trim().replace(/^@+/, '');
  if (!h) return '';

  const locRaw = (locationLabel || '').trim();
  const locOk = locRaw && locRaw !== 'Unknown Location';
  const atPos = h.indexOf('@');

  if (atPos >= 0) {
    const user = h.slice(0, atPos).trim().replace(/^@+/, '');
    const place = h.slice(atPos + 1).trim().replace(/^@+/, '');
    if (!user) return place || h;
    if (!place) {
      return locOk ? `${user}@${locRaw}` : user;
    }
    return `${user}@${place}`;
  }

  if (locOk) {
    return `${h}@${locRaw}`;
  }
  return h;
}

/** Heuristic: body text reads as “light on dark” (e.g. white on blue card) vs dark on light. */
export function isLikelyLightTextColor(colorCss: string): boolean {
  const c = colorCss.trim().toLowerCase();
  if (c === 'white' || c === '#fff' || c === '#ffffff') return true;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    const n = parseInt(h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55;
  }
  const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const r = Math.min(255, parseInt(rgb[1], 10));
    const g = Math.min(255, parseInt(rgb[2], 10));
    const b = Math.min(255, parseInt(rgb[3], 10));
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55;
  }
  return true;
}
