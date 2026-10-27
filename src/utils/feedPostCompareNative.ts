import type { PostMediaItem, StickerOverlay } from '../types';

/**
 * Lightweight structural comparators for the feed memo boundaries.
 *
 * These replace `JSON.stringify(a) === JSON.stringify(b)` inside `React.memo`
 * comparators. Stringify allocates and serializes the whole subtree on every diff
 * pass for every mounted cell — pure JS-thread work that lands exactly during a
 * fling. The helpers below walk only the fields the renderers actually read and
 * short-circuit on the first mismatch, with zero string allocation.
 *
 * They stay intentionally strict about ordering: a reordered array is treated as a
 * change (the same behaviour `JSON.stringify` had), so semantics are unchanged.
 */

type TextStyleLike = {
    color?: string;
    size?: string;
    background?: string;
    fontFamily?: string;
};

function stringArraysEqual(
    a?: readonly string[] | null,
    b?: readonly string[] | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export { stringArraysEqual };

export function textStylesEqual(
    a?: TextStyleLike | null,
    b?: TextStyleLike | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.color === b.color &&
        a.size === b.size &&
        a.background === b.background &&
        a.fontFamily === b.fontFamily
    );
}

type MediaEffect = NonNullable<PostMediaItem['effects']>[number];

function effectsEqual(
    a?: readonly MediaEffect[] | null,
    b?: readonly MediaEffect[] | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const x = a[i];
        const y = b[i];
        if (x === y) continue;
        if (!x || !y) return false;
        if (
            x.type !== y.type ||
            x.intensity !== y.intensity ||
            x.duration !== y.duration ||
            x.startTime !== y.startTime
        ) {
            return false;
        }
    }
    return true;
}

export function mediaItemsEqual(
    a?: readonly PostMediaItem[] | null,
    b?: readonly PostMediaItem[] | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const x = a[i];
        const y = b[i];
        if (x === y) continue;
        if (!x || !y) return false;
        if (
            x.url !== y.url ||
            x.type !== y.type ||
            x.posterUrl !== y.posterUrl ||
            x.thumbnailUrl !== y.thumbnailUrl ||
            x.thumbnail_url !== y.thumbnail_url ||
            x.width !== y.width ||
            x.height !== y.height ||
            x.aspectRatio !== y.aspectRatio ||
            x.duration !== y.duration ||
            x.text !== y.text
        ) {
            return false;
        }
        if (!textStylesEqual(x.textStyle, y.textStyle)) return false;
        if (!effectsEqual(x.effects, y.effects)) return false;
    }
    return true;
}

export function stickersEqual(
    a?: readonly StickerOverlay[] | null,
    b?: readonly StickerOverlay[] | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const x = a[i];
        const y = b[i];
        if (x === y) continue;
        if (!x || !y) return false;
        if (
            x.id !== y.id ||
            x.stickerId !== y.stickerId ||
            x.x !== y.x ||
            x.y !== y.y ||
            x.scale !== y.scale ||
            x.rotation !== y.rotation ||
            x.opacity !== y.opacity ||
            x.startTime !== y.startTime ||
            x.endTime !== y.endTime ||
            x.textContent !== y.textContent ||
            x.textColor !== y.textColor ||
            x.fontSize !== y.fontSize ||
            x.sticker?.url !== y.sticker?.url ||
            x.sticker?.emoji !== y.sticker?.emoji
        ) {
            return false;
        }
    }
    return true;
}
