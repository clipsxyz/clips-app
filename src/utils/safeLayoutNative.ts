/**
 * Android ReactViewGroup.drawChild crashes when yoga receives NaN/Infinity/undefined
 * for layout props (width, height, left, top, etc.). Sanitize before applying styles.
 */

export function safeLayoutNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : fallback;
}

/** Positive layout size — never 0/NaN for View frames that Android will draw. */
export function safePositiveLayoutNumber(value: unknown, fallback: number): number {
    const n = safeLayoutNumber(value, fallback);
    return n > 0 ? n : fallback;
}

export function safeScale(value: unknown, fallback = 1): number {
    const n = safeLayoutNumber(value, fallback);
    if (n <= 0) return fallback;
    // Avoid extreme scales that produce invalid native frames.
    return Math.min(Math.max(n, 0.05), 8);
}

export function hasFinitePoint(x: unknown, y: unknown): boolean {
    return Number.isFinite(safeLayoutNumber(x, NaN)) && Number.isFinite(safeLayoutNumber(y, NaN));
}
