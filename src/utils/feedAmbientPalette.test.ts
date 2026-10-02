import { describe, expect, it } from 'vitest';

import {
    AMBIENT_BASE_HEX,
    AMBIENT_FALLBACK_HEX,
    amplifyAmbientAccent,
    isHexColor,
    mixHex,
    normalizeHex,
    resolveAmbientAccent,
    resolveServerAmbientAccent,
} from './feedAmbientPalette';

describe('isHexColor', () => {
    it('accepts #rgb and #rrggbb', () => {
        expect(isHexColor('#fff')).toBe(true);
        expect(isHexColor('#0B0E14')).toBe(true);
        expect(isHexColor('#0b0e14')).toBe(true);
    });

    it('accepts #rrggbbaa but normalizeHex drops alpha', () => {
        expect(isHexColor('#0B0E1480')).toBe(true);
        expect(normalizeHex('#0b0e1480')).toBe('#0B0E14');
    });

    it('rejects non-hex and wrong lengths', () => {
        expect(isHexColor('#ff')).toBe(false);
        expect(isHexColor('#fffff')).toBe(false);
        expect(isHexColor('rgb(1,2,3)')).toBe(false);
        expect(isHexColor('0B0E14')).toBe(false);
        expect(isHexColor(null)).toBe(false);
        expect(isHexColor(undefined)).toBe(false);
        expect(isHexColor(0x0b0e14)).toBe(false);
    });
});

describe('normalizeHex', () => {
    it('expands shorthand and uppercases', () => {
        expect(normalizeHex('#abc')).toBe('#AABBCC');
        expect(normalizeHex('  #1e2638  ')).toBe('#1E2638');
    });

    it('returns null for untrustworthy input so the chain can fall through', () => {
        expect(normalizeHex('nope')).toBeNull();
        expect(normalizeHex({})).toBeNull();
    });
});

describe('mixHex', () => {
    it('returns endpoints at t=0 and t=1', () => {
        expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
        expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    });

    it('interpolates linearly and clamps out-of-range t', () => {
        expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
        expect(mixHex('#000000', '#FFFFFF', -5)).toBe('#000000');
        expect(mixHex('#000000', '#FFFFFF', 5)).toBe('#FFFFFF');
    });

    it('falls back to the base on invalid input', () => {
        expect(mixHex('bad', '#FFFFFF', 0.5)).toBe(AMBIENT_BASE_HEX);
    });
});

describe('amplifyAmbientAccent', () => {
    it('leaves mid accents in a readable band', () => {
        const mid = amplifyAmbientAccent('#8899AA');
        expect(mid.startsWith('#')).toBe(true);
        expect(mid.length).toBe(7);
    });

    it('lifts near-black samples so scroll shifts stay visible', () => {
        const lifted = amplifyAmbientAccent('#2C2A26');
        expect(lifted).not.toBe('#2C2A26');
        expect(lifted.startsWith('#')).toBe(true);
        expect(lifted.length).toBe(7);
        // Must be brighter than the crushed input.
        const toLum = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        };
        expect(toLum(lifted)).toBeGreaterThan(toLum('#2C2A26'));
    });

    it('produces distinct lifts for different dark samples', () => {
        expect(amplifyAmbientAccent('#030510')).not.toBe(amplifyAmbientAccent('#554E6F'));
    });
});

describe('resolveAmbientAccent', () => {
    it('prefers dominant over accent', () => {
        expect(resolveAmbientAccent({ dominant_color: '#8899AA', accent_color: '#445566' })).toBe(
            amplifyAmbientAccent('#8899AA'),
        );
    });

    it('reads camelCase mapped posts', () => {
        expect(resolveAmbientAccent({ dominantColor: '#AABBCC' })).toBe(
            amplifyAmbientAccent('#AABBCC'),
        );
    });

    it('falls through to accent when dominant is missing or malformed', () => {
        expect(resolveAmbientAccent({ accent_color: '#8899AA' })).toBe(
            amplifyAmbientAccent('#8899AA'),
        );
        expect(resolveAmbientAccent({ dominant_color: 'not-a-color', accent_color: '#8899AA' })).toBe(
            amplifyAmbientAccent('#8899AA'),
        );
    });

    it('skips a malformed accent rather than emitting an invalid colour', () => {
        expect(resolveAmbientAccent({ dominant_color: '', accent_color: 'rgb(0,0,0)' })).toBe(
            AMBIENT_BASE_HEX,
        );
    });

    it('falls back to the dark neutral base when the post is absent', () => {
        expect(resolveAmbientAccent(null)).toBe(AMBIENT_BASE_HEX);
        expect(resolveAmbientAccent(undefined)).toBe(AMBIENT_BASE_HEX);
        expect(resolveAmbientAccent({})).toBe(AMBIENT_BASE_HEX);
        expect(AMBIENT_FALLBACK_HEX).toBe(AMBIENT_BASE_HEX);
    });

    it('amplifies dark server dominants through the public resolver', () => {
        expect(resolveAmbientAccent({ dominant_color: '#112233' })).toBe(
            amplifyAmbientAccent('#112233'),
        );
    });
});

describe('resolveServerAmbientAccent', () => {
    it('returns null (NOT the fallback) when the payload has no colour', () => {
        expect(resolveServerAmbientAccent(null)).toBeNull();
        expect(resolveServerAmbientAccent({})).toBeNull();
        expect(resolveServerAmbientAccent({ dominant_color: 'bad' })).toBeNull();
    });

    it('returns the amplified server colour when present, so no sampling is needed', () => {
        expect(resolveServerAmbientAccent({ dominant_color: '#112233' })).toBe(
            amplifyAmbientAccent('#112233'),
        );
    });

    it('agrees with resolveAmbientAccent on the present case', () => {
        const post = { accent_color: '#8899AA' };
        expect(resolveServerAmbientAccent(post)).toBe(resolveAmbientAccent(post));
    });
});
