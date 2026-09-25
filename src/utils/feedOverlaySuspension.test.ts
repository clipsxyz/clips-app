import { describe, expect, it } from 'vitest';

import {
    isHeavyFeedSheetOpen,
    shouldSuspendFeedVideo,
    type FeedOverlayState,
} from './feedOverlaySuspension';

const CLOSED: FeedOverlayState = {
    commentsModalOpen: false,
    scenesViewerActive: false,
    scenesOverlay: false,
    imageFullscreenPost: false,
    shareModalOpen: false,
    dmSheetOpen: false,
    taggedSheetPost: false,
    gazetteerAlertOpen: false,
    reclipConfirmOpen: false,
    likesSheetPost: false,
};

const withOverlay = (patch: Partial<FeedOverlayState>): FeedOverlayState => ({
    ...CLOSED,
    ...patch,
});

describe('shouldSuspendFeedVideo', () => {
    it('does not suspend when nothing is open', () => {
        expect(shouldSuspendFeedVideo(CLOSED)).toBe(false);
    });

    it.each([
        ['share', { shareModalOpen: true }],
        ['dm', { dmSheetOpen: true }],
        ['tagged user', { taggedSheetPost: true }],
        ['gazetteer alert', { gazetteerAlertOpen: true }],
        ['reclip confirm', { reclipConfirmOpen: true }],
    ])('suspends for the %s sheet', (_label, patch) => {
        expect(shouldSuspendFeedVideo(withOverlay(patch))).toBe(true);
    });

    it.each([
        ['comments', { commentsModalOpen: true }],
        ['scenes viewer', { scenesViewerActive: true }],
        ['scenes overlay', { scenesOverlay: true }],
        ['image fullscreen', { imageFullscreenPost: true }],
    ])('still suspends for the pre-existing %s overlay', (_label, patch) => {
        expect(shouldSuspendFeedVideo(withOverlay(patch))).toBe(true);
    });

    // Regression guard: the quick-likes sheet is a lightweight popover and must
    // keep the clip running underneath it.
    it('keeps playing under the lightweight likes sheet', () => {
        expect(shouldSuspendFeedVideo(withOverlay({ likesSheetPost: true }))).toBe(false);
    });

    it('keeps playing under a likes sheet opened on top of no other overlay', () => {
        expect(isHeavyFeedSheetOpen(withOverlay({ likesSheetPost: true }))).toBe(false);
    });

    it('still suspends when a heavy sheet is open behind the likes sheet', () => {
        const s = withOverlay({ likesSheetPost: true, shareModalOpen: true });
        expect(shouldSuspendFeedVideo(s)).toBe(true);
    });
});

describe('isHeavyFeedSheetOpen', () => {
    it('is false for likes-only and for the non-sheet overlays', () => {
        expect(isHeavyFeedSheetOpen(CLOSED)).toBe(false);
        expect(isHeavyFeedSheetOpen(withOverlay({ likesSheetPost: true }))).toBe(false);
        expect(isHeavyFeedSheetOpen(withOverlay({ commentsModalOpen: true }))).toBe(false);
        expect(isHeavyFeedSheetOpen(withOverlay({ imageFullscreenPost: true }))).toBe(false);
    });

    it('agrees with shouldSuspendFeedVideo when only heavy sheets are involved', () => {
        const heavy = withOverlay({ dmSheetOpen: true });
        expect(isHeavyFeedSheetOpen(heavy)).toBe(shouldSuspendFeedVideo(heavy));
    });
});
