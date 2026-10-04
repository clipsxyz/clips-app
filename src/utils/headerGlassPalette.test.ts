import { describe, expect, it } from 'vitest';
import {
    HEADER_GLASS_NEUTRAL,
    HEADER_GLASS_PALETTE,
    headerGlassColorAt,
    hexToRgba,
} from './headerGlassPalette';

describe('headerGlassPalette tokens', () => {
    it('anchors the neutral header to the obsidian canvas floor', () => {
        expect(HEADER_GLASS_NEUTRAL).toBe('#0B0E14');
        expect(hexToRgba(HEADER_GLASS_NEUTRAL, 0.95)).toBe('rgba(11, 14, 20, 0.95)');
    });

    it('keeps every palette accent distinct from the neutral floor', () => {
        for (const hex of HEADER_GLASS_PALETTE) {
            expect(hex).not.toBe(HEADER_GLASS_NEUTRAL);
        }
    });
});

describe('headerGlassColorAt', () => {
    it('exposes the twelve vibrant accents in order', () => {
        expect([...HEADER_GLASS_PALETTE]).toEqual([
            '#FF4D6D',
            '#7209B7',
            '#FFB703',
            '#F72585',
            '#00B4D8',
            '#10B981',
            '#4338CA',
            '#FF6B35',
            '#00F5D4',
            '#E11D48',
            '#84CC16',
            '#3A86EF',
        ]);
    });

    it('holds twelve distinct hex accents', () => {
        expect(HEADER_GLASS_PALETTE).toHaveLength(12);
        expect(new Set(HEADER_GLASS_PALETTE).size).toBe(12);
    });

    it('maps ordinals onto distinct consecutive colours', () => {
        const seen = HEADER_GLASS_PALETTE.map((_, i) => headerGlassColorAt(i));
        expect(new Set(seen).size).toBe(HEADER_GLASS_PALETTE.length);
    });

    it('cycles once the palette is exhausted', () => {
        const count = HEADER_GLASS_PALETTE.length;
        expect(headerGlassColorAt(count)).toBe(headerGlassColorAt(0));
        expect(headerGlassColorAt(count + 1)).toBe(headerGlassColorAt(1));
        expect(headerGlassColorAt(count * 2 + 3)).toBe(headerGlassColorAt(3));
        expect(headerGlassColorAt(600)).toBe(headerGlassColorAt(600 % count));
    });

    it('wraps negative ordinals instead of indexing out of bounds', () => {
        const count = HEADER_GLASS_PALETTE.length;
        expect(headerGlassColorAt(-1)).toBe(HEADER_GLASS_PALETTE[count - 1]);
        expect(headerGlassColorAt(-count)).toBe(HEADER_GLASS_PALETTE[0]);
        expect(headerGlassColorAt(-count - 2)).toBe(HEADER_GLASS_PALETTE[count - 2]);
    });

    it('falls back to the first accent for non-finite input', () => {
        expect(headerGlassColorAt(Number.NaN)).toBe(HEADER_GLASS_PALETTE[0]);
        expect(headerGlassColorAt(Number.POSITIVE_INFINITY)).toBe(HEADER_GLASS_PALETTE[0]);
    });
});

describe('hexToRgba', () => {
    it('converts palette hexes to rgba', () => {
        expect(hexToRgba('#00B4D8', 0.8)).toBe('rgba(0, 180, 216, 0.8)');
        expect(hexToRgba('#FFB703', 0.4)).toBe('rgba(255, 183, 3, 0.4)');
    });

    it('clamps alpha into the 0..1 range', () => {
        expect(hexToRgba('#10B981', 5)).toBe('rgba(16, 185, 129, 1)');
        expect(hexToRgba('#10B981', -2)).toBe('rgba(16, 185, 129, 0)');
    });

    it('returns null for unparseable input so callers keep their previous tint', () => {
        expect(hexToRgba('not-a-colour', 0.8)).toBeNull();
        expect(hexToRgba('#12', 0.8)).toBeNull();
        expect(hexToRgba('', 0.8)).toBeNull();
    });

    it('produces only rgba output for every palette entry', () => {
        for (const hex of HEADER_GLASS_PALETTE) {
            expect(hexToRgba(hex, 0.8)).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
        }
    });
});
